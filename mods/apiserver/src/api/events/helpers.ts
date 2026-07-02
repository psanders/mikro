/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { EventClient } from "./recordEvent.js";

/** Fallback actor name when the acting user cannot be resolved (system flows). */
export const SYSTEM_ACTOR_NAME = "Sistema";

/**
 * Whether a client can persist business events. The real Prisma client exposes
 * `businessEvent.create`; the hand-written `DbClient` abstraction used by unit
 * tests (and its mocks) deliberately does not. Producers gate event writing on
 * this so they behave identically to before when handed a non-event client —
 * the real event path is exercised by the integration tests against a real DB.
 */
export function canRecordEvents(client: unknown): boolean {
  const c = client as { businessEvent?: { create?: unknown } } | null | undefined;
  return typeof c?.businessEvent?.create === "function";
}

/** Opaque feed cursor = base64 of `${occurredAtISO}|${id}`. */
export function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`, "utf-8").toString("base64");
}

/** Decode a feed cursor; returns null when malformed. */
export function decodeCursor(cursor: string): { occurredAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const sep = decoded.lastIndexOf("|");
    if (sep === -1) return null;
    const iso = decoded.slice(0, sep);
    const id = decoded.slice(sep + 1);
    const occurredAt = new Date(iso);
    if (!id || Number.isNaN(occurredAt.getTime())) return null;
    return { occurredAt, id };
  } catch {
    return null;
  }
}

/**
 * Resolve a human actor name from a user id, inside the caller's transaction so
 * the denormalized name is captured atomically with the event. Falls back to
 * `SYSTEM_ACTOR_NAME` when there is no id or the user cannot be found.
 */
export async function resolveActorName(
  client: EventClient,
  actorId: string | null | undefined
): Promise<string> {
  if (!actorId) return SYSTEM_ACTOR_NAME;
  const user = await client.user.findUnique({
    where: { id: actorId },
    select: { name: true }
  });
  return user?.name?.trim() || SYSTEM_ACTOR_NAME;
}

/** Format an amount as a Dominican-peso string, e.g. `RD$ 2,500`. */
export function formatDop(amount: number): string {
  return `RD$ ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Human label for a loan application (no numeric id exists until conversion):
 * the applicant's full name, else the business name, else a short id.
 */
export function applicationDisplayName(app: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
}): string {
  const name = [app.firstName, app.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (app.businessName?.trim()) return app.businessName.trim();
  return `#${app.id.slice(0, 8)}`;
}

/** LoanApplication columns that hold DateTime values (for snapshot round-trip). */
export const APPLICATION_DATE_FIELDS = new Set<string>([
  "dateOfBirth",
  "scoredAt",
  "reviewedAt",
  "signedAt",
  "idUploadedAt",
  "submittedAt",
  "createdAt",
  "updatedAt"
]);

/**
 * Convert a Prisma row into a JSON-safe plain object: Date → ISO string,
 * Decimal (and any object exposing `toNumber`/`toString`) → number. Used to
 * snapshot a LoanApplication into a deletion event's payload.
 */
export function toJsonSafeSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = toJsonSafeValue(value);
  }
  return out;
}

function toJsonSafeValue(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as { toNumber?: () => number; constructor?: { name?: string } };
    // Prisma Decimal exposes toNumber(); JSON objects (rawData) do not.
    if (typeof obj.toNumber === "function") return obj.toNumber();
  }
  return value;
}

/**
 * Rebuild Prisma create data from a snapshot produced by `toJsonSafeSnapshot`:
 * ISO strings for known date columns become Date objects again. Decimals stay
 * numbers (Prisma accepts numbers for Decimal); JSON columns stay as-is.
 */
export function snapshotToCreateData(snapshot: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (APPLICATION_DATE_FIELDS.has(key) && typeof value === "string") {
      data[key] = new Date(value);
    } else {
      data[key] = value;
    }
  }
  return data;
}
