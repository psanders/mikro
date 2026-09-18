/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Ad-quality report data builder (issue #280): applications grouped by the ad
 * that produced them, with the risk-band split and median Mikro Score.
 *
 * The point is to judge an ad on the borrowers it brings rather than on how many
 * forms it filled. Lead count alone calls the ad with 12 applicants and no
 * approvable one the best in the account; this report calls it the worst.
 *
 * Everything it needs is already on our side — `scoreApplication` runs inside
 * `createUpsertApplication`, so every row carries `score` and `riskBand` — and
 * the score is deliberately never sent to Meta (see the note by
 * `createSendLeadConversion` in index.ts). That keeps the report working at 8
 * leads a week, where Meta's own attribution reports zero.
 */
import {
  withErrorHandlingAndValidation,
  generateAdQualityReportSchema,
  type GenerateAdQualityReportInput,
  type DbClient,
  type LoanApplication,
  type RiskBand
} from "@mikro/common";
import { logger } from "../../logger.js";

/** Default window: long enough to accumulate leads at this budget, short enough to be current. */
const DEFAULT_WINDOW_DAYS = 14;

/**
 * Statuses that mean a human decided to lend. `SIGNED` and `CONVERTED` are past
 * `APPROVED`, so counting only `APPROVED` would make an ad look worse the better
 * it did.
 */
const APPROVED_STATUSES = new Set(["APPROVED", "SIGNED", "CONVERTED"]);

/** Bands worth having, and bands not. `OUT_OF_COVERAGE` is neither — it is a geography problem. */
const GOOD_BANDS = new Set<RiskBand>(["LOW_RISK", "MODERATE_RISK"]);
const BAD_BANDS = new Set<RiskBand>(["HIGH_RISK", "VERY_HIGH_RISK"]);

/** One ad's numbers, or the organic bucket when `adId` is null. */
export interface AdQualityRow {
  /** Meta ad id, or null for the organic / direct bucket. */
  adId: string | null;
  /** Name as the click reported it, or null when we only ever saw the id. */
  adName: string | null;
  adsetName: string | null;
  campaignName: string | null;
  /** Submitted applications (RECEIVED and beyond). */
  leads: number;
  /** Started but never submitted. Kept apart from `leads` rather than inflating them. */
  drafts: number;
  /** LOW_RISK + MODERATE_RISK among the leads. */
  lowOrModerate: number;
  /** HIGH_RISK + VERY_HIGH_RISK among the leads. */
  highOrVeryHigh: number;
  /** Full band split, including OUT_OF_COVERAGE and unscored rows. */
  bands: Record<string, number>;
  /** Median ISC of the scored leads; null when the ad produced none. */
  medianScore: number | null;
  approved: number;
}

export interface AdQualityReportData {
  /** Inclusive window bounds as ISO dates, echoed so a printed report is self-describing. */
  since: string;
  until: string;
  rows: AdQualityRow[];
  totals: {
    leads: number;
    drafts: number;
    lowOrModerate: number;
    highOrVeryHigh: number;
    approved: number;
    medianScore: number | null;
  };
}

export interface GeneratedAdQualityReport {
  data: AdQualityReportData;
}

/** Median of an unsorted list, rounded. Null for an empty list — not zero, which reads as "terrible". */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/**
 * Window bounds are whole local days. Built from the date's parts rather than
 * `new Date("2026-09-01")`, which is UTC midnight — 8pm the day before in Santo
 * Domingo — and would put an evening's applications in the wrong fortnight.
 */
function startOfLocalDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 0, 0, 0, 0);
}

function endOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** The local calendar day a Date falls on, as YYYY-MM-DD (never via toISOString). */
function toLocalDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Bucket {
  applications: LoanApplication[];
}

/**
 * Creates a function that generates the ad-quality report: every ad we know of
 * (including ones that produced nothing in the window — a spending ad with no
 * applications is the finding, and omitting its row would hide it) plus an
 * organic bucket, never merged into an ad's numbers.
 *
 * @param client - The database client
 */
export function createGenerateAdQualityReport(client: DbClient) {
  const fn = async (params: GenerateAdQualityReportInput): Promise<GeneratedAdQualityReport> => {
    const until = endOfLocalDay(params.until ? startOfLocalDay(params.until) : new Date());
    let since: Date;
    if (params.since) {
      since = startOfLocalDay(params.since);
    } else {
      // Inclusive of both ends: 14 days means today and the 13 before it.
      since = new Date(until);
      since.setDate(since.getDate() - (DEFAULT_WINDOW_DAYS - 1));
      since.setHours(0, 0, 0, 0);
    }

    logger.verbose("generating ad quality report", {
      since: toLocalDay(since),
      until: toLocalDay(until)
    });

    // Attribution is stamped when the applicant arrives, so the window is read
    // on createdAt: an ad owns the clicks it bought that fortnight, whether or
    // not the applicant got round to submitting inside it.
    const applications = await client.loanApplication.findMany({
      where: { createdAt: { gte: since, lte: until } },
      orderBy: { createdAt: "asc" }
    });

    // The catalog is the roster of ads, not the applications — that is what lets
    // an ad with zero applications appear. It also carries the names, so the
    // report needs no live Meta call and survives a deleted campaign.
    const catalog = await client.metaAd.findMany({ orderBy: { lastSeenAt: "desc" } });

    const buckets = new Map<string | null, Bucket>();
    // Seed every known ad first so zero-application ones survive to the output.
    for (const ad of catalog) buckets.set(ad.id, { applications: [] });
    buckets.set(null, { applications: [] });

    for (const application of applications) {
      // An id we have no catalog entry for still gets its own row, under its id:
      // better a row labelled 120212… than an ad silently counted as organic.
      const key = application.adId ?? null;
      const bucket = buckets.get(key) ?? { applications: [] };
      bucket.applications.push(application);
      buckets.set(key, bucket);
    }

    const catalogById = new Map(catalog.map((ad) => [ad.id, ad]));
    const rows: AdQualityRow[] = [];

    for (const [adId, bucket] of buckets) {
      const leads = bucket.applications.filter((a) => a.status !== "DRAFT");
      const drafts = bucket.applications.length - leads.length;
      const bands: Record<string, number> = {};
      let lowOrModerate = 0;
      let highOrVeryHigh = 0;
      const scores: number[] = [];

      for (const lead of leads) {
        const band = lead.riskBand ?? "UNSCORED";
        bands[band] = (bands[band] ?? 0) + 1;
        if (GOOD_BANDS.has(band as RiskBand)) lowOrModerate += 1;
        if (BAD_BANDS.has(band as RiskBand)) highOrVeryHigh += 1;
        if (lead.score != null) scores.push(lead.score);
      }

      const ad = adId ? catalogById.get(adId) : undefined;
      rows.push({
        adId,
        adName: ad?.name ?? null,
        adsetName: ad?.adsetName ?? null,
        campaignName: ad?.campaignName ?? null,
        leads: leads.length,
        drafts,
        lowOrModerate,
        highOrVeryHigh,
        bands,
        medianScore: median(scores),
        approved: leads.filter((a) => APPROVED_STATUSES.has(a.status)).length
      });
    }

    // Loudest first — the ad with the most leads is the one whose quality is
    // most worth questioning. Organic is pinned last: it is context, not a
    // decision anyone can act on.
    rows.sort((a, b) => {
      if (a.adId === null) return 1;
      if (b.adId === null) return -1;
      if (b.leads !== a.leads) return b.leads - a.leads;
      return (a.adName ?? a.adId).localeCompare(b.adName ?? b.adId);
    });

    const allLeads = applications.filter((a) => a.status !== "DRAFT");
    const data: AdQualityReportData = {
      since: toLocalDay(since),
      until: toLocalDay(until),
      rows,
      totals: {
        leads: allLeads.length,
        drafts: applications.length - allLeads.length,
        lowOrModerate: rows.reduce((sum, r) => sum + r.lowOrModerate, 0),
        highOrVeryHigh: rows.reduce((sum, r) => sum + r.highOrVeryHigh, 0),
        approved: rows.reduce((sum, r) => sum + r.approved, 0),
        medianScore: median(allLeads.map((a) => a.score).filter((s): s is number => s != null))
      }
    };

    logger.verbose("ad quality report generated", {
      ads: rows.length - 1,
      leads: data.totals.leads
    });

    return { data };
  };

  return withErrorHandlingAndValidation(fn, generateAdQualityReportSchema);
}
