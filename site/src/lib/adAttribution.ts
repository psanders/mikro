/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * Which ad brought the visitor here.
 *
 * Meta substitutes these into the ad's destination URL at click time (Ads
 * Manager → ad → Tracking → URL parameters), so an applicant who clicks an ad
 * lands on `/?ad_id=…&ad_name=…`. They are read once on arrival and kept for the
 * session, because almost nobody clicks an ad and submits the form in the same
 * breath: they land on `/`, read, navigate to `/solicitud`, and by then the
 * query string is long gone.
 *
 * The site does nothing with them beyond posting them with the application. What
 * they are FOR is on the server: they are the join key that lets the Mikro Score
 * be reported per ad, so an ad is judged on the quality of the borrowers it
 * brings and not on how many forms it filled (issue #280).
 */

/** Query parameter → payload key. The values on the right go to the API. */
const PARAM_TO_FIELD = {
  ad_id: "adId",
  adset_id: "adsetId",
  campaign_id: "campaignId",
  ad_name: "adName",
  adset_name: "adsetName",
  campaign_name: "campaignName"
} as const;

export type AdAttribution = Partial<
  Record<(typeof PARAM_TO_FIELD)[keyof typeof PARAM_TO_FIELD], string>
>;

const STORAGE_KEY = "mikro:ad-attribution";

/**
 * `sessionStorage` rather than `localStorage`: attribution belongs to this
 * visit. Someone who clicked an ad in March and comes back directly in June
 * applied organically, and crediting that ad would quietly overstate it.
 */
function readStore(): AdAttribution | null {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AdAttribution) : null;
  } catch {
    // Private mode, disabled storage, or a value someone hand-edited into
    // nonsense. Losing attribution is acceptable; breaking the form is not.
    return null;
  }
}

/**
 * Reads the ad parameters off the current URL and remembers them for the rest of
 * the session. Safe to call on every page load — a later page without the
 * parameters (the visitor navigating on to `/solicitud`) leaves the stored value
 * alone rather than clearing it.
 *
 * @param search - Query string to read; defaults to the current location's
 */
export function captureAdAttribution(search: string = window.location.search): AdAttribution {
  const params = new URLSearchParams(search);
  const captured: AdAttribution = {};

  for (const [param, field] of Object.entries(PARAM_TO_FIELD)) {
    const value = params.get(param)?.trim();
    // Meta leaves the macro unexpanded ("{{ad.id}}") when a parameter is set on
    // something it cannot resolve — storing that would create a phantom ad.
    if (value && !value.startsWith("{{")) captured[field] = value;
  }

  // An ad id is what makes the rest meaningful; a stray `ad_name` on its own is
  // not attribution and gets ignored.
  if (!captured.adId) return readStore() ?? {};

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(captured));
  } catch {
    // Same as above: best-effort. The current page can still post what it read.
  }
  return captured;
}

/** The ad parameters captured earlier in this session, or `{}` for organic visits. */
export function readAdAttribution(): AdAttribution {
  return readStore() ?? {};
}
