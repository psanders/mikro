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

const whatsappTemplatesSchema = z.object({
  paymentConfirmation: z.string().default("payment_receipt"),
  // Approved Flow template whose CTA opens the loan-application intake Flow.
  // Sent as the "promoción" when a reviewer opts in on manual creation.
  loanApplicationPromo: z.string().default("loan_application"),
  // TEMPORARY: the currently approved `loan_application` template is English, so
  // its send language is pinned here independently of the shared `languageCode`.
  // When set, it overrides the language for the promo send only; leave empty to
  // fall back to `whatsapp.languageCode`. Remove the default once a Spanish
  // (es_DO) template is approved.
  loanApplicationPromoLanguage: z.string().default("en"),
  // The promo template has an IMAGE header, which WhatsApp requires as a
  // per-send parameter (the sample set in the template is not reused). Point this
  // at a publicly reachable JPEG/PNG of the promo banner.
  loanApplicationPromoImageUrl: z.string().default("")
});

const whatsappSchema = z.object({
  phoneNumberId: z.string().min(1, "WhatsApp phoneNumberId is required"),
  accessToken: z.string().min(1, "WhatsApp accessToken is required"),
  verifyToken: z.string().default("mikro_webhook_token"),
  languageCode: z.string().default("es_DO"),
  templates: whatsappTemplatesSchema.default(() => ({
    paymentConfirmation: "payment_receipt",
    loanApplicationPromo: "loan_application",
    loanApplicationPromoLanguage: "en",
    loanApplicationPromoImageUrl: ""
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
    receiptsPath: z.string().default("/app/receipts"),
    // Where signed loan-application contract PDFs are stored on disk.
    contractsPath: z.string().default("/app/contracts"),
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
    contract: contractSchema
  })
  .strict();

export type MikroConfig = z.infer<typeof mikroConfigSchema>;

/** Config with optional sections filled with defaults (what getConfig() returns). */
export type ResolvedMikroConfig = Omit<
  MikroConfig,
  "whatsapp" | "voiceNotes" | "evals" | "reports" | "accounting" | "loans" | "contract"
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
 * Fixed legal-entity data for the loan contract (creditor, payment account,
 * notary). Sourced from mikro.json, not hardcoded — it is real PII.
 */
export function getContractConfig(): ContractConfig {
  return getConfig().contract;
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
