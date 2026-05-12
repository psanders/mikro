/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mikro configuration schema and loader. Configuration is read from mikro.json
 * at the project root (or a custom path). No environment variable fallback.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
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

/** Valid agent names for disabledAgents. */
export const AGENT_NAMES_CONFIG = ["joan", "juan", "maria"] as const;
const agentNameSchema = z.enum(AGENT_NAMES_CONFIG);

const llmPurposesSchema = z.object({
  text: llmConfigSchema,
  vision: llmConfigSchema,
  evals: llmConfigSchema
});

const whatsappTemplatesSchema = z.object({
  paymentConfirmation: z.string().default("payment_receipt"),
  paymentReminder: z.string().default("payment_reminder"),
  paymentOverdue: z.string().default("payment_overdue")
});

const whatsappSchema = z.object({
  phoneNumberId: z.string().min(1, "WhatsApp phoneNumberId is required"),
  accessToken: z.string().min(1, "WhatsApp accessToken is required"),
  verifyToken: z.string().default("mikro_webhook_token"),
  languageCode: z.string().default("es_DO"),
  templates: whatsappTemplatesSchema.default(() => ({
    paymentConfirmation: "payment_receipt",
    paymentReminder: "payment_reminder",
    paymentOverdue: "payment_overdue"
  }))
});

const collectionsSchema = z.object({
  enabled: z.boolean().default(true),
  cron: z.string().default("0 8 * * *"),
  dryRun: z.boolean().default(false),
  includeDefaulted: z.boolean().default(true)
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

const fonosterSchema = z
  .object({
    enabled: z.boolean().default(false),
    workspaceAccessKeyId: z.string().default(""),
    apikeyAccessKeyId: z.string().default(""),
    apikeyAccessKeySecret: z.string().default(""),
    fromNumber: z.string().default(""),
    appRef: z.string().default("")
  })
  .refine(
    (data) =>
      !data.enabled ||
      (data.workspaceAccessKeyId &&
        data.apikeyAccessKeyId &&
        data.apikeyAccessKeySecret &&
        data.fromNumber &&
        data.appRef),
    {
      message:
        "When fonoster.enabled is true, workspaceAccessKeyId, apikeyAccessKeyId, apikeyAccessKeySecret, fromNumber, and appRef are required"
    }
  );

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
    receiptsPath: z.string().default("/app/receipts"),
    databaseUrl: z.string().default("file:/app/data/mikro.db"),
    jwtSecret: z
      .string()
      .min(1, "jwtSecret is required for JWT auth")
      .default("dev-jwt-secret-change-in-production"),
    jwtExpiresIn: z.string().default("7d"),
    keysPath: z.string().default("/app/keys"),
    assetsPath: z.string().default("/app/mods/apiserver/assets"),
    messageMaxAgeSeconds: z.number().default(60),
    sessionTimeoutSeconds: z.number().default(1800),
    disabledAgents: z.array(agentNameSchema).default([]),
    llm: llmPurposesSchema,
    whatsapp: whatsappSchema,
    collections: collectionsSchema.default(() => ({
      enabled: true,
      cron: "0 8 * * *",
      dryRun: false,
      includeDefaulted: true
    })),
    fonoster: fonosterSchema.default(() => ({
      enabled: false,
      workspaceAccessKeyId: "",
      apikeyAccessKeyId: "",
      apikeyAccessKeySecret: "",
      fromNumber: "",
      appRef: ""
    })),
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
    loans: loansSchema.default(defaultLoansConfig)
  })
  .strict();

export type MikroConfig = z.infer<typeof mikroConfigSchema>;

/** Config with optional sections filled with defaults (what getConfig() returns). */
export type ResolvedMikroConfig = Omit<
  MikroConfig,
  | "whatsapp"
  | "collections"
  | "fonoster"
  | "voiceNotes"
  | "evals"
  | "reports"
  | "accounting"
  | "loans"
> & {
  whatsapp: MikroConfig["whatsapp"] & {
    templates: NonNullable<MikroConfig["whatsapp"]["templates"]>;
  };
  collections: NonNullable<MikroConfig["collections"]>;
  fonoster: NonNullable<MikroConfig["fonoster"]>;
  voiceNotes: NonNullable<MikroConfig["voiceNotes"]>;
  evals: NonNullable<MikroConfig["evals"]> & {
    vendors: NonNullable<NonNullable<MikroConfig["evals"]>["vendors"]>;
  };
  reports: NonNullable<MikroConfig["reports"]>;
  accounting: NonNullable<MikroConfig["accounting"]>;
  loans: LoansConfig;
};

const DEFAULT_CONFIG_FILENAME = "mikro.json";

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
