/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * How each renewal status looks (Pencil EzobQ sec-12): one place for the chip
 * and pill colors so the feed card, the panel and the copilot card agree.
 */
import { RENEWAL_STATUS_LABELS_ES, type LoanRenewalStatus } from "@mikro/common/schemas";

export interface RenewalTone {
  /** Icon chip: background + glyph color. */
  chip: string;
  /** Status pill: background + text color. */
  pill: string;
  /** The pill's dot. */
  dot: string;
}

export const RENEWAL_TONES: Record<LoanRenewalStatus, RenewalTone> = {
  DRAFT: {
    chip: "bg-ds-subtle text-ds-muted",
    pill: "bg-ds-subtle text-ds-muted",
    dot: "bg-ds-muted"
  },
  CONTRACT_READY: {
    chip: "bg-brand-mist text-brand-blue-primary",
    pill: "bg-brand-mist text-brand-blue-primary",
    dot: "bg-brand-blue-primary"
  },
  SIGNED: {
    chip: "bg-ds-amber-bg text-ds-amber",
    pill: "bg-ds-amber-bg text-ds-amber",
    dot: "bg-ds-amber"
  },
  COMPLETED: {
    chip: "bg-ds-green-bg text-ds-green",
    pill: "bg-ds-green-bg text-ds-green",
    dot: "bg-ds-green"
  },
  CANCELLED: {
    chip: "bg-ds-red-bg text-ds-red",
    pill: "bg-ds-red-bg text-ds-red",
    dot: "bg-ds-red"
  }
};

export const renewalStatusLabel = (status: string): string =>
  RENEWAL_STATUS_LABELS_ES[status as LoanRenewalStatus] ?? status;

export const renewalTone = (status: string): RenewalTone =>
  RENEWAL_TONES[status as LoanRenewalStatus] ?? RENEWAL_TONES.DRAFT;
