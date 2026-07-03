/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared field handling for `applications:create` / `applications:update` —
 * the normalized ("stable") content fields plus a generic `--field key=value`
 * escape hatch for the rest (`APPLICATION_RAW_ONLY_KEYS`), since the server
 * accepts any string patch (`Record<string, string>`) and re-derives the
 * typed columns from it.
 */
import { input, select } from "@inquirer/prompts";
import { Flags } from "@oclif/core";
import { BUSINESS_TYPE_LABELS, PROVINCE_LABELS } from "@mikro/common";

export const businessTypeChoices = Object.entries(BUSINESS_TYPE_LABELS).map(([value, name]) => ({
  name,
  value
}));

export const provinceChoices = Object.entries(PROVINCE_LABELS).map(([value, name]) => ({
  name,
  value
}));

/** oclif flags for the 13 STABLE_KEYS content fields, shared by create + update. */
export const applicationStableFlags = {
  "first-name": Flags.string({ description: "Applicant first name", required: false }),
  "last-name": Flags.string({ description: "Applicant last name", required: false }),
  phone: Flags.string({
    description: "Applicant phone (e.g. +18091234567)",
    required: false
  }),
  "id-number": Flags.string({
    description: "Cédula (format: 000-0000000-0)",
    required: false
  }),
  "date-of-birth": Flags.string({
    description: "Date of birth (YYYY-MM-DD)",
    required: false
  }),
  "marital-status": Flags.string({
    description: "Marital status (free text, e.g. 'Casado(a)')",
    required: false
  }),
  "business-type": Flags.string({
    description: "Business type code",
    required: false,
    options: Object.keys(BUSINESS_TYPE_LABELS)
  }),
  "business-name": Flags.string({ description: "Business name", required: false }),
  "requested-amount": Flags.string({
    description: "Requested loan amount (DOP, digits only)",
    required: false
  }),
  purpose: Flags.string({ description: "Loan purpose", required: false }),
  "requested-term-weeks": Flags.string({
    description: "Requested term in weeks",
    required: false
  }),
  province: Flags.string({
    description: "Province code",
    required: false,
    options: Object.keys(PROVINCE_LABELS)
  }),
  "home-address": Flags.string({ description: "Home address", required: false })
} as const;

/** Repeatable `--field key=value` escape hatch for RAW_ONLY_KEYS and any other content field. */
export const applicationFieldFlag = {
  field: Flags.string({
    description:
      "Additional content field as key=value (repeatable). Covers businessAge, monthlySales, " +
      "locationType, formalization, employeeCount, businessPhone, spouseName, spousePhone, " +
      "referenceName, referencePhone, housingType, residenceTime, addressReference, or any " +
      "other content key.",
    multiple: true,
    required: false
  })
} as const;

/** Parses `--field key=value` flags into a patch object; throws on a malformed entry. */
export function parseFieldFlags(values: string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of values ?? []) {
    const idx = raw.indexOf("=");
    if (idx <= 0) {
      throw new Error(`Invalid --field value: "${raw}". Expected key=value.`);
    }
    const key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1);
    if (!key) {
      throw new Error(`Invalid --field value: "${raw}". Expected key=value.`);
    }
    out[key] = value;
  }
  return out;
}

type StableFlagValues = {
  [K in keyof typeof applicationStableFlags]?: string;
};

/**
 * Builds the STABLE_KEYS portion of a patch, prompting interactively (TTY
 * only) for any flag left unset. `defaults` prefills prompts for `update`
 * (existing values); omit for `create`.
 */
export async function resolveStableFields(
  flags: StableFlagValues,
  defaults?: Partial<Record<keyof StableFlagValues, string>>
): Promise<Record<string, string>> {
  const isTTY = process.stdout.isTTY;
  const d = defaults ?? {};

  async function field(
    flagKey: keyof StableFlagValues,
    message: string,
    fallback?: string
  ): Promise<string> {
    const v = flags[flagKey];
    if (v !== undefined) return v;
    if (!isTTY) return fallback ?? "";
    return input({ message, default: fallback ?? "", required: false });
  }

  async function selectField(
    flagKey: keyof StableFlagValues,
    message: string,
    choices: Array<{ name: string; value: string }>,
    fallback?: string
  ): Promise<string> {
    const v = flags[flagKey];
    if (v !== undefined) return v;
    if (!isTTY) return fallback ?? "";
    const withBlank = [{ name: "(skip)", value: "" }, ...choices];
    return select({ message, choices: withBlank, default: fallback ?? "" });
  }

  const patch: Record<string, string> = {
    firstName: await field("first-name", "First name", d["first-name"]),
    lastName: await field("last-name", "Last name", d["last-name"]),
    phone: await field("phone", "Phone (e.g. +18091234567)", d.phone),
    idNumber: await field("id-number", "Cédula (000-0000000-0)", d["id-number"]),
    dateOfBirth: await field("date-of-birth", "Date of birth (YYYY-MM-DD)", d["date-of-birth"]),
    maritalStatus: await field("marital-status", "Marital status", d["marital-status"]),
    businessType: await selectField(
      "business-type",
      "Business type",
      businessTypeChoices,
      d["business-type"]
    ),
    businessName: await field("business-name", "Business name", d["business-name"]),
    requestedAmount: await field(
      "requested-amount",
      "Requested amount (DOP)",
      d["requested-amount"]
    ),
    purpose: await field("purpose", "Loan purpose", d.purpose),
    requestedTermWeeks: await field(
      "requested-term-weeks",
      "Requested term (weeks)",
      d["requested-term-weeks"]
    ),
    province: await selectField("province", "Province", provinceChoices, d.province),
    homeAddress: await field("home-address", "Home address", d["home-address"])
  };

  // Drop blanks — an empty string patch value would overwrite an existing
  // value with "" on update, and creates noise on create.
  for (const key of Object.keys(patch)) {
    if (patch[key] === "") delete patch[key];
  }
  return patch;
}
