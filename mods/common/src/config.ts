/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mikro configuration schema and loader. Configuration is read from mikro.json
 * at the project root (or a custom path). No environment variable fallback.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import { z } from "zod/v4";

/** Supported LLM vendors. */
export const LLM_VENDORS = ["openai", "anthropic", "google"] as const;
export type LLMVendor = (typeof LLM_VENDORS)[number];

/** Zod schema for a single LLM configuration. */
export const llmConfigSchema = z.object({
  vendor: z.enum(LLM_VENDORS),
  apiKey: z.string().min(1, "API key is required"),
  model: z.string().min(1, "Model name is required")
});
export type LLMConfig = z.infer<typeof llmConfigSchema>;

const llmPurposesSchema = z.object({
  text: llmConfigSchema,
  vision: llmConfigSchema,
  evals: llmConfigSchema
});

// All templates are registered under the single shared `whatsapp.languageCode`
// (es_DO). There are intentionally no per-template language overrides.
const whatsappTemplatesSchema = z.object({
  // Approved template sent to the borrower after a payment: landscape receipt
  // card as the image header, "Descargar recibo" URL button.
  paymentConfirmation: z.string().default("payment_receipt"),
  // Approved Flow template whose CTA opens the loan-application intake Flow.
  // Sent as the "promoción" when a reviewer opts in on manual creation.
  loanApplicationPromo: z.string().default("loan_application"),
  // The promo template has an IMAGE header, which WhatsApp requires as a
  // per-send parameter (the sample set in the template is not reused). Point this
  // at a publicly reachable JPEG/PNG of the promo banner.
  loanApplicationPromoImageUrl: z.string().default(""),
  // Follow-up nudge template: text-only, no image header, no flow button.
  // Sent 10 min after a RECEIVED application if still unattended.
  loanApplicationFollowUp: z.string().default("loan_application")
});

const whatsappSchema = z.object({
  phoneNumberId: z.string().min(1, "WhatsApp phoneNumberId is required"),
  accessToken: z.string().min(1, "WhatsApp accessToken is required"),
  verifyToken: z.string().default("mikro_webhook_token"),
  languageCode: z.string().default("es_DO"),
  templates: whatsappTemplatesSchema.default(() => ({
    paymentConfirmation: "payment_receipt",
    loanApplicationPromo: "loan_application",
    loanApplicationPromoImageUrl: "",
    loanApplicationFollowUp: "loan_application"
  }))
});

const evalsVendorOverrideSchema = z.object({
  text: llmConfigSchema.nullable(),
  vision: llmConfigSchema.nullable()
});

const evalsVendorsSchema = z.object({
  openai: evalsVendorOverrideSchema.optional(),
  anthropic: evalsVendorOverrideSchema.optional(),
  google: evalsVendorOverrideSchema.optional()
});

const evalsSchema = z.object({
  similarityThreshold: z.number().min(0).max(1).default(0.7),
  vendors: evalsVendorsSchema.default(() => ({}))
});

const voiceNotesSchema = z.object({
  enabled: z.boolean().default(false),
  deepgramApiKey: z.string().default("")
});

/**
 * Target for the in-app feedback button (mikro/#69): a GitHub PAT with
 * `repo` scope (or fine-grained Issues: write + Contents: write) and the
 * "owner/repo" the button files issues against. Both empty by default —
 * `createSubmitFeedback` fails fast with a clear error rather than a
 * confusing GitHub 401/404 when unconfigured.
 */
const githubFeedbackSchema = z.object({
  token: z.string().default(""),
  repo: z.string().default("")
});

/** Default max remaining installments by frequency to consider a loan "near completion" for renewal report. */
export const DEFAULT_NEAR_COMPLETION_THRESHOLDS: Record<string, number> = {
  DAILY: 7,
  WEEKLY: 2,
  BIWEEKLY: 1,
  MONTHLY: 1
};

const reportsSchema = z
  .object({
    /** Max remaining installments by payment frequency to include in renewal candidates report. */
    nearCompletionThresholds: z.record(z.string(), z.number().int().min(0)).optional()
  })
  .default(() => ({}));

const accountingSchema = z
  .object({
    /** Where transaction attachments (receipts) are saved. Resolved relative to the config dir. */
    attachmentsPath: z.string().default("./data/attachments/accounting")
  })
  .default(() => ({ attachmentsPath: "./data/attachments/accounting" }));

const followUpSchema = z
  .object({
    /** Minutes after a RECEIVED application arrives before the nudge WhatsApp message is sent. */
    nudgeDelayMinutes: z.number().int().min(1).default(10),
    /** Hours after the nudge is sent before an unresponsive application is marked ABANDONED. */
    abandonDelayHours: z.number().int().min(1).default(8)
  })
  .default(() => ({ nudgeDelayMinutes: 10, abandonDelayHours: 8 }));

/**
 * Desktop auto-update settings. The Tauri dashboard points its updater at the
 * apiserver (`/v1/updates/manifest`), which serves a folder populated at deploy
 * time: the release CI signs the installers, rewrites the manifest's download
 * URLs to this server, and rsyncs both into `path`. The apiserver only serves
 * those static files — no GitHub access at runtime — so updates keep working
 * unchanged once the repo goes private.
 */
const updatesSchema = z
  .object({
    /** Enable the /v1/updates/* endpoints. Off by default. */
    enabled: z.boolean().default(false),
    /**
     * Directory holding the signed manifest + installers, populated by the
     * release workflow. Relative paths resolve against the mikro.json dir; the
     * default sits under the mounted data volume so it survives redeploys.
     */
    path: z.string().default("./data/updates"),
    /** Manifest filename within `path` (tauri-action emits `latest.json`). */
    manifestFilename: z.string().default("latest.json")
  })
  .default(() => ({
    enabled: false,
    path: "./data/updates",
    manifestFilename: "latest.json"
  }));

/** QCobro sync mode: how the push reconciles with QCobro-side data. */
export const QCOBRO_SYNC_MODES = ["APPEND_ONLY", "UPDATE_EXISTING", "REPLACE"] as const;
export type QCobroSyncMode = (typeof QCOBRO_SYNC_MODES)[number];

/** Which Mikro money figure becomes the QCobro account balance. See QCOBRO.md. */
export const QCOBRO_BALANCE_BASES = [
  "outstanding_with_mora",
  "outstanding_principal",
  "past_due_amount",
  "next_installment"
] as const;
export type QCobroBalanceBasis = (typeof QCOBRO_BALANCE_BASES)[number];

/** `namespace:value` tag, e.g. `status:past_due`, `dpd:8_30`, `risk:premium`. */
const qcobroTagSchema = z
  .string()
  .regex(/^(status|dpd|risk):[a-z0-9_]+$/, "Tag must look like status:x, dpd:x, or risk:x");

/** A `portfolios[]` entry: tag predicate (all/any/none, ANDed) -> target QCobro portfolio id. */
const qcobroPortfolioMatchSchema = z
  .object({
    all: z.array(qcobroTagSchema).optional(),
    any: z.array(qcobroTagSchema).optional(),
    none: z.array(qcobroTagSchema).optional()
  })
  .strict();

const qcobroPortfolioRuleSchema = z
  .object({
    id: z.string().min(1, "Portfolio id is required"),
    match: qcobroPortfolioMatchSchema
  })
  .strict();

/**
 * Minimal cron-expression shape check (5 whitespace-separated fields). Full
 * semantic validation happens at parse time via `croner` when the worker
 * starts; this only rejects obviously malformed strings at config-load time.
 */
const cronExpressionSchema = z.string().refine((v) => v.trim().split(/\s+/).length === 5, {
  message: "schedule must be a 5-field cron expression (e.g. '0 6 * * *')"
});

/**
 * QCobro (https://docs.qcobro.com) collections integration. Mikro is the source of
 * truth for portfolio membership: it derives tags from loan/payment state plus
 * manual `risk:` assertions, evaluates `portfolios[]` rules, and pushes the result
 * one direction into QCobro. See QCOBRO.md at the repo root for the full model.
 */
const qcobroSchema = z
  .object({
    /** QCobro server-to-server API key. Placeholder until provided. */
    apiKey: z.string().default("qc_PLACEHOLDER"),
    /** QCobro API secret. Placeholder until provided. */
    apiSecret: z.string().default("qcs_PLACEHOLDER"),
    /** QCobro workspace id (isolation container for portfolios/campaigns/accounts). */
    workspace: z.string().default("ws_PLACEHOLDER"),
    /** Base URL for the QCobro API. Override for staging/self-hosted. */
    apiUrl: z.string().default("https://api.qcobro.com"),
    /** How account/portfolio pushes reconcile with QCobro-side data. */
    syncMode: z.enum(QCOBRO_SYNC_MODES).default("UPDATE_EXISTING"),
    /** Which Mikro money figure is pushed as the QCobro account balance. */
    balanceBasis: z.enum(QCOBRO_BALANCE_BASES).default("past_due_amount"),
    /** Cron expression for the periodic recompute + sync job. Evaluated in `timezone`. */
    schedule: cronExpressionSchema.default("0 6 * * *"),
    /** Declarative tag-predicate -> QCobro portfolio mapping rules. */
    portfolios: z.array(qcobroPortfolioRuleSchema).default([]),
    /**
     * When true, the sync service logs the `syncAccounts` batch it
     * would print instead of calling the network — safe to leave on while
     * iterating on tags/portfolio rules. Set false to push for real.
     */
    dryRun: z.boolean().default(false)
  })
  .strict()
  .default(() => ({
    apiKey: "qc_PLACEHOLDER",
    apiSecret: "qcs_PLACEHOLDER",
    workspace: "ws_PLACEHOLDER",
    apiUrl: "https://api.qcobro.com",
    syncMode: "UPDATE_EXISTING" as const,
    balanceBasis: "past_due_amount" as const,
    schedule: "0 6 * * *",
    portfolios: [],
    dryRun: false
  }));

export type QCobroConfig = z.infer<typeof qcobroSchema>;
export type QCobroPortfolioRule = z.infer<typeof qcobroPortfolioRuleSchema>;

/** Past-due (mora) fee policy. See README "Past-due fee". */
export const loansSchema = z.object({
  /** Annualized-style rate applied as `rate * (daysLate/30) * cuota` (e.g. 0.10 = 10%). */
  defaultMoraRate: z.number().min(0).max(1).default(0.1),
  /** No mora if calendar days late is at or below this (after effective-from window). */
  moraGraceDays: z.number().int().min(0).default(0),
  /** Cap accrued mora at this multiple of one cuota (e.g. 1 = at most one full cuota of mora). */
  moraCapInCuotas: z.number().min(0).default(1),
  /** Minimum mora in DOP when mora is otherwise positive (0 = no floor). */
  moraMinDop: z.number().min(0).default(0),
  /** When true, do not accrue mora past `loan.updatedAt` for DEFAULTED loans. */
  moraStopOnDefault: z.boolean().default(false),
  /** If set (YYYY-MM-DD), mora accrual starts from the later of this date and the oldest unpaid due date. */
  moraEffectiveFrom: z
    .union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "moraEffectiveFrom must be YYYY-MM-DD"),
      z.null()
    ])
    .optional()
});

export type LoansConfig = z.infer<typeof loansSchema>;

/**
 * Dominican cédula format 000-0000000-0 (3-7-1). Empty is allowed so the app
 * boots without contract data; a non-empty value must be well-formed.
 */
const CEDULA_RE = /^\d{3}-\d{7}-\d{1}$/;
const cedulaField = z
  .string()
  .default("")
  .refine((v) => v === "" || CEDULA_RE.test(v), {
    message: "cédula must look like 000-0000000-0"
  });

/**
 * RNC: a 9-digit company RNC (e.g. 1-23-45678-9) or an 11-digit cédula used as
 * RNC. Validate digit count rather than dash placement, which varies. Empty ok.
 */
const rncField = z
  .string()
  .default("")
  .refine((v) => v === "" || (/^[\d-]+$/.test(v) && [9, 11].includes(v.replace(/-/g, "").length)), {
    message: "RNC must be 9 or 11 digits (e.g. 1-23-45678-9 or 000-0000000-0)"
  });

/**
 * Fixed legal-entity data printed on the loan contract (creditor, payment
 * account, certifying notary). This is real PII/business data, so it lives in
 * mikro.json (gitignored) rather than source. Names are stored in proper case
 * and upper-cased at render time. All fields default to empty so the app boots
 * without it; contracts just render blanks until it's filled.
 */
const contractSchema = z
  .object({
    creditor: z
      .object({
        legalName: z.string().default(""),
        rnc: rncField,
        address: z.string().default(""),
        representative: z
          .object({
            name: z.string().default(""),
            cedula: cedulaField,
            city: z.string().default("")
          })
          .default(() => ({ name: "", cedula: "", city: "" }))
      })
      .default(() => ({
        legalName: "",
        rnc: "",
        address: "",
        representative: { name: "", cedula: "", city: "" }
      })),
    payment: z
      .object({
        bank: z.string().default(""),
        accountType: z.string().default(""),
        accountNumber: z.string().default(""),
        accountHolder: z.string().default(""),
        accountHolderCedula: cedulaField
      })
      .default(() => ({
        bank: "",
        accountType: "",
        accountNumber: "",
        accountHolder: "",
        accountHolderCedula: ""
      })),
    mora: z
      .object({
        ratePct: z.number().default(10),
        periodDays: z.number().default(30)
      })
      .default(() => ({ ratePct: 10, periodDays: 30 })),
    city: z.string().default(""),
    notary: z
      .object({
        name: z.string().default(""),
        collegeNumber: z.string().default(""),
        rnc: rncField,
        office: z.string().default(""),
        municipality: z.string().default("")
      })
      .default(() => ({ name: "", collegeNumber: "", rnc: "", office: "", municipality: "" }))
  })
  .default(() => ({
    creditor: {
      legalName: "",
      rnc: "",
      address: "",
      representative: { name: "", cedula: "", city: "" }
    },
    payment: {
      bank: "",
      accountType: "",
      accountNumber: "",
      accountHolder: "",
      accountHolderCedula: ""
    },
    mora: { ratePct: 10, periodDays: 30 },
    city: "",
    notary: { name: "", collegeNumber: "", rnc: "", office: "", municipality: "" }
  }));

export type ContractConfig = z.infer<typeof contractSchema>;

const defaultLoansConfig = (): LoansConfig => ({
  defaultMoraRate: 0.1,
  moraGraceDays: 0,
  moraCapInCuotas: 1,
  moraMinDop: 0,
  moraStopOnDefault: false,
  moraEffectiveFrom: undefined
});

export const mikroConfigSchema = z
  .object({
    timezone: z.string().default("America/Santo_Domingo"),
    port: z.number().default(4000),
    publicUrl: z.string().default("http://localhost:4000"),
    // Origins allowed to call the API from a browser: the ops dashboard web build
    // and Tauri webview, plus the public website (which posts loan applications to
    // the public intake endpoint). Native clients (mobile/CLI) are unaffected by
    // CORS. Defaults cover local dev; add the deployed dashboard + website origins
    // here in production.
    corsAllowedOrigins: z
      .array(z.string())
      .default([
        "http://localhost:5174",
        "tauri://localhost",
        "http://tauri.localhost",
        "http://localhost:5173"
      ]),
    receiptsPath: z.string().default("/app/data/receipts"),
    // Where signed loan-application contract PDFs are stored on disk.
    contractsPath: z.string().default("/app/data/contracts"),
    databaseUrl: z.string().default("file:/app/data/mikro.db"),
    jwtSecret: z
      .string()
      .min(1, "jwtSecret is required for JWT auth")
      .default("dev-jwt-secret-change-in-production"),
    jwtExpiresIn: z.string().default("30d"),
    keysPath: z.string().default("/app/keys"),
    assetsPath: z.string().default("/app/mods/apiserver/assets"),
    messageMaxAgeSeconds: z.number().default(60),
    sessionTimeoutSeconds: z.number().default(1800),
    // Path to the agents YAML file. Relative paths resolve against the
    // mikro.json directory. Agents enable/disable themselves in that file, so
    // there is no disable list here.
    agentsFile: z.string().default("agents.yaml"),
    llm: llmPurposesSchema,
    whatsapp: whatsappSchema,
    voiceNotes: voiceNotesSchema.default(() => ({
      enabled: false,
      deepgramApiKey: ""
    })),
    evals: evalsSchema.default(() => ({
      similarityThreshold: 0.7,
      vendors: {}
    })),
    reports: reportsSchema.default(() => ({})),
    accounting: accountingSchema.default(() => ({
      attachmentsPath: "./data/attachments/accounting"
    })),
    loans: loansSchema.default(defaultLoansConfig),
    contract: contractSchema,
    followUp: followUpSchema,
    updates: updatesSchema,
    qcobro: qcobroSchema,
    githubFeedback: githubFeedbackSchema.default(() => ({ token: "", repo: "" }))
  })
  .strict();

export type MikroConfig = z.infer<typeof mikroConfigSchema>;

/** Config with optional sections filled with defaults (what getConfig() returns). */
export type ResolvedMikroConfig = Omit<
  MikroConfig,
  | "whatsapp"
  | "voiceNotes"
  | "evals"
  | "reports"
  | "accounting"
  | "loans"
  | "contract"
  | "updates"
  | "qcobro"
> & {
  whatsapp: MikroConfig["whatsapp"] & {
    templates: NonNullable<MikroConfig["whatsapp"]["templates"]>;
  };
  voiceNotes: NonNullable<MikroConfig["voiceNotes"]>;
  evals: NonNullable<MikroConfig["evals"]> & {
    vendors: NonNullable<NonNullable<MikroConfig["evals"]>["vendors"]>;
  };
  reports: NonNullable<MikroConfig["reports"]>;
  accounting: NonNullable<MikroConfig["accounting"]>;
  loans: LoansConfig;
  contract: ContractConfig;
  updates: NonNullable<MikroConfig["updates"]>;
  qcobro: QCobroConfig;
};

const DEFAULT_CONFIG_FILENAME = "mikro.json";

/**
 * Resolve the path to the agents YAML file. The path comes from `mikro.json`'s
 * `agentsFile` (default `agents.yaml`); relative paths resolve against the
 * mikro.json directory. Agents live in this file so their prompts/tools/copy
 * can be edited without rebuilding the apiserver image.
 *
 * @param override - Explicit path that wins over the configured value
 */
export function getAgentsConfigFilePath(override?: string): string {
  if (override) return resolvePathFromConfigDir(override);
  return resolvePathFromConfigDir(getConfig().agentsFile);
}

/**
 * Read and parse the agents YAML file as a raw array. YAML is chosen for its
 * readability with the large prompts and eval scenarios agents carry.
 * Validation of each entry (schema + tool existence) is the caller's
 * responsibility, done in @mikro/agents, which owns the Agent shape and the
 * tool registry.
 *
 * @throws Error if the file is missing, unreadable, or not an array
 */
export function loadRawAgentsConfig(override?: string): unknown[] {
  const filePath = getAgentsConfigFilePath(override);
  if (!existsSync(filePath)) {
    throw new Error(
      `Agents config file not found at ${filePath}. Provide the tracked agents.yaml (repo root) at this path.`
    );
  }
  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(filePath, "utf-8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read or parse ${filePath}: ${message}`);
  }
  if (!Array.isArray(raw)) {
    throw new Error(`Invalid agents config at ${filePath}: expected a top-level array of agents.`);
  }
  return raw;
}

/** Default database URL (container path). Must match mikroConfigSchema default. */
export const DEFAULT_DATABASE_URL = "file:/app/data/mikro.db";

let cachedConfig: ResolvedMikroConfig | null = null;

/**
 * Resolve the path to mikro.json. Use this whenever you need to find the config file
 * (e.g. Prisma, seed, or before loading .env so MIKRO_CONFIG_FILE is not yet set).
 *
 * Resolution order:
 *   1. Explicit `override` argument
 *   2. `MIKRO_CONFIG_FILE` environment variable
 *   3. `baseDir/mikro.json` (default filename in baseDir or cwd)
 *
 * @param override - Explicit path (overrides env and default)
 * @param baseDir - Directory for relative paths when env is unset (default: process.cwd())
 */
export function getConfigFilePath(override?: string, baseDir?: string): string {
  const base = baseDir ?? process.cwd();
  const raw = override ?? process.env.MIKRO_CONFIG_FILE ?? DEFAULT_CONFIG_FILENAME;
  return path.resolve(base, raw);
}

/**
 * Read databaseUrl from the config file without loading or validating the full config.
 * Use from Prisma config and seed scripts. Respects MIKRO_CONFIG_FILE.
 * @param configPath - Optional explicit config file path
 * @param baseDir - Optional base directory when resolving default path (e.g. repo root)
 */
export function getDatabaseUrlFromFile(configPath?: string, baseDir?: string): string {
  const filePath = getConfigFilePath(configPath, baseDir);
  if (!existsSync(filePath)) return DEFAULT_DATABASE_URL;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as { databaseUrl?: unknown };
    if (typeof raw.databaseUrl === "string" && raw.databaseUrl.trim()) return raw.databaseUrl;
  } catch {
    // fall through to default
  }
  return DEFAULT_DATABASE_URL;
}

/**
 * Normalize a SQLite databaseUrl to an absolute `file:` URL. A relative `file:`
 * path is resolved against the directory containing the config file — never
 * process.cwd() — so the server, `migrate deploy`, and the seed all attach to the
 * SAME database no matter which working directory they're launched from. Without
 * this, a relative URL spawns a second db (e.g. a stray nested data/mikro.db) and
 * migrations land on one file while the server reads another. Non-file URLs
 * (e.g. ":memory:") are returned unchanged.
 *
 * @param databaseUrl - The raw databaseUrl from config
 * @param configFilePath - Path to the config file (its directory is the base)
 */
export function resolveDatabaseUrl(databaseUrl: string, configFilePath?: string): string {
  const FILE_PREFIX = "file:";
  if (!databaseUrl.startsWith(FILE_PREFIX)) return databaseUrl;
  const filePath = databaseUrl.slice(FILE_PREFIX.length);
  // In-memory and absolute paths need no resolution.
  if (filePath.startsWith(":") || path.isAbsolute(filePath)) return databaseUrl;
  const baseDir = configFilePath ? path.dirname(configFilePath) : path.dirname(getConfigFilePath());
  return `${FILE_PREFIX}${path.resolve(baseDir, filePath)}`;
}

/**
 * The loaded config's databaseUrl, normalized to an absolute `file:` URL via
 * {@link resolveDatabaseUrl}. Use this (not `getConfig().databaseUrl`) wherever a
 * SQLite connection is opened, so the path is cwd-independent.
 */
export function getResolvedDatabaseUrl(): string {
  return resolveDatabaseUrl(getConfig().databaseUrl, getConfigFilePath());
}

/**
 * Resolve a path from config (e.g. keysPath, assetsPath). If the path is absolute, return as-is.
 * Otherwise resolve it relative to the directory containing the config file.
 */
export function resolvePathFromConfigDir(
  relativeOrAbsolutePath: string,
  configFilePath?: string
): string {
  if (path.isAbsolute(relativeOrAbsolutePath)) return relativeOrAbsolutePath;
  const baseDir = configFilePath ? path.dirname(configFilePath) : path.dirname(getConfigFilePath());
  return path.resolve(baseDir, relativeOrAbsolutePath);
}

/**
 * Path to the logo file (assetsPath/logo.png). Use for reports and exports.
 */
export function getLogoPath(): string {
  const cfg = getConfig();
  return resolvePathFromConfigDir(path.join(cfg.assetsPath, "logo.png"));
}

/**
 * Public HTTP route the API server serves the loan-application promo banner at,
 * and the asset filename on disk. The `loan_application` WhatsApp template has an
 * image header that WhatsApp fetches by URL at send time; serving it from the API
 * server (already public for the webhook) avoids an external host.
 */
export const LOAN_APPLICATION_PROMO_ASSET_ROUTE = "/assets/loan-application-promo.jpg";

/** Disk path to the promo banner asset (assetsPath/loan-application-promo.jpg). */
export function getPromoBannerPath(): string {
  const cfg = getConfig();
  return resolvePathFromConfigDir(path.join(cfg.assetsPath, "loan-application-promo.jpg"));
}

/**
 * Public, UNAUTHENTICATED route prefix for receipt images. A signed token is
 * appended as the path segment: `GET /r/:token` verifies the token and returns
 * the landscape receipt card as a PNG. The payment-confirmation WhatsApp template
 * uses this both as its image header (fetched by URL at send time) and as its
 * "Descargar recibo" button target (the recipient opens the full receipt).
 */
export const RECEIPT_ROUTE_PREFIX = "/r";

/** Public image URL for a signed receipt token (`{publicUrl}/r/:token`). */
export function getReceiptImageUrl(token: string): string {
  const publicBase = getConfig().publicUrl.replace(/\/+$/, "");
  return `${publicBase}${RECEIPT_ROUTE_PREFIX}/${token}`;
}

/**
 * Public, UNAUTHENTICATED route the Tauri desktop updater polls for a release
 * manifest. The apiserver serves the signed `latest.json` from the configured
 * updates folder, or 204 when none is present. Authentication isn't possible
 * here — the updater runs before login — so safety rests on the signed manifest
 * + client-side pubkey verification, not on the transport.
 */
export const UPDATES_MANIFEST_ROUTE = "/v1/updates/manifest";

/**
 * Public, UNAUTHENTICATED route prefix the updater downloads installer bytes
 * from: `GET /v1/updates/asset/:name`. The apiserver streams the matching file
 * from the configured updates folder. The bytes are verified against the
 * bundled pubkey before installing.
 */
export const UPDATES_ASSET_ROUTE_PREFIX = "/v1/updates/asset";

/** Desktop auto-update settings (GitHub repo, optional token, cache TTL). */
export function getUpdatesConfig(): ResolvedMikroConfig["updates"] {
  return getConfig().updates;
}

/** QCobro integration settings (credentials, syncMode, balanceBasis, schedule, portfolios[]). */
export function getQCobroConfig(): ResolvedMikroConfig["qcobro"] {
  return getConfig().qcobro;
}

/**
 * Payment-confirmation template config: the approved template sent to the
 * borrower after a payment (image header = receipt card, URL button = download).
 * Sent under the shared `whatsapp.languageCode`.
 */
export function getWhatsAppPaymentConfirmationTemplate(): {
  templateName: string;
  languageCode: string;
} {
  const cfg = getConfig();
  return {
    templateName: cfg.whatsapp.templates.paymentConfirmation,
    languageCode: cfg.whatsapp.languageCode
  };
}

/**
 * Fixed legal-entity data for the loan contract (creditor, payment account,
 * notary). Sourced from mikro.json, not hardcoded — it is real PII.
 */
export function getContractConfig(): ContractConfig {
  return getConfig().contract;
}

/** Delay values for the two-stage follow-up timer, converted to milliseconds. */
export function getFollowUpTimerConfig(): { nudgeDelayMs: number; abandonDelayMs: number } {
  const cfg = getConfig();
  return {
    nudgeDelayMs: cfg.followUp.nudgeDelayMinutes * 60 * 1000,
    abandonDelayMs: cfg.followUp.abandonDelayHours * 60 * 60 * 1000
  };
}

/** Template name + language for the follow-up nudge send. */
export function getWhatsAppFollowUpTemplate(): { templateName: string; languageCode: string } {
  const cfg = getConfig();
  return {
    templateName: cfg.whatsapp.templates.loanApplicationFollowUp,
    languageCode: cfg.whatsapp.languageCode
  };
}

/**
 * Load and validate configuration from a JSON file.
 * Uses getConfigFilePath() so MIKRO_CONFIG_FILE is respected when no path is passed.
 * @throws Error if file is missing, unreadable, or validation fails
 */
export function loadConfig(configPath?: string): ResolvedMikroConfig {
  const path = getConfigFilePath(configPath);
  if (!existsSync(path)) {
    throw new Error(
      `Mikro config file not found at ${path}. Create mikro.json from mikro.json.example.`
    );
  }
  let raw: unknown;
  try {
    const content = readFileSync(path, "utf-8");
    raw = JSON.parse(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read or parse ${path}: ${message}`);
  }
  const result = mikroConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid mikro.json: ${issues}`);
  }
  return result.data as ResolvedMikroConfig;
}

/**
 * Return the loaded configuration. Loads on first call and caches.
 * Config file path is resolved via getConfigFilePath() (MIKRO_CONFIG_FILE or default).
 * @throws Error if config file is missing or invalid
 */
export function getConfig(configPath?: string): ResolvedMikroConfig {
  if (cachedConfig) {
    return cachedConfig;
  }
  cachedConfig = loadConfig(configPath);
  return cachedConfig;
}

/**
 * Clear the config cache. Used in tests.
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
