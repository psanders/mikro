/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Run a single collection action (reminder, overdue notice, or call) for one loan.
 * Caller can force channel and type, or let the system auto-determine from missed payments.
 */

import {
  getMissedPaymentsCount,
  COLLECTION_CALL_MIN_MISSED,
  COLLECTION_OVERDUE_MIN_MISSED
} from "@mikro/common";
import type { CollectionChannel, CollectionAttemptType } from "../generated/prisma/enums.js";
import {
  CollectionChannel as Channel,
  CollectionAttemptType as AttemptType
} from "../generated/prisma/enums.js";
import { isPaymentDayToday, formatPaymentDayForTemplate } from "./dayOfWeek.js";
import { loanToData } from "./loanToData.js";
import {
  getPaymentReminderTemplateName,
  getOverdueNoticeTemplateName,
  getWhatsAppLanguageCode
} from "./collectionConfig.js";
import { initiateCollectionCall } from "./fonosterClient.js";
import {
  executeCollectionAction,
  isDryRun,
  logDryRun,
  type CollectionDeps,
  type CollectionTarget
} from "./collectionAttemptHelper.js";

export type RunSingleCollectionDeps = CollectionDeps;

export interface RunSingleCollectionInput {
  loanId: number;
  channel?: CollectionChannel;
  type?: CollectionAttemptType;
  dryRun?: boolean;
  includeDefaulted?: boolean;
}

export interface RunSingleCollectionResult {
  success: boolean;
  loanId: number;
  type: CollectionAttemptType;
  channel: CollectionChannel;
  memberName: string;
  dryRun: boolean;
  error?: string;
}

function defaultChannelForType(type: CollectionAttemptType): CollectionChannel {
  return type === AttemptType.COLLECTION_CALL ? Channel.PHONE_CALL : Channel.WHATSAPP;
}

/**
 * Run a single collection action for the given loan.
 * If type is not provided, auto-determines from missed payments (same rules as daily run).
 * If channel is not provided, uses WHATSAPP for reminder/notice and PHONE_CALL for call.
 */
export async function runSingleCollection(
  input: RunSingleCollectionInput,
  deps: RunSingleCollectionDeps
): Promise<RunSingleCollectionResult> {
  const asOfDate = new Date();
  const dryRun = input.dryRun ?? isDryRun();

  const loan = await deps.db.loan.findUnique({
    where: { loanId: input.loanId },
    include: {
      member: true,
      payments: {
        where: { status: "COMPLETED" },
        orderBy: { paidAt: "asc" }
      }
    }
  });

  const allowedStatuses = ["ACTIVE", ...(input.includeDefaulted ? ["DEFAULTED"] : [])];
  if (!loan || !allowedStatuses.includes(loan.status) || !loan.member) {
    return {
      success: false,
      loanId: input.loanId,
      type: AttemptType.PAYMENT_REMINDER,
      channel: Channel.WHATSAPP,
      memberName: "",
      dryRun,
      error: "Loan not found or not active"
    };
  }

  const member = loan.member;
  const memberInfo = { id: member.id, name: member.name, phone: member.phone };
  const loanInfo = { id: loan.id, loanId: loan.loanId };
  const target: CollectionTarget = { member: memberInfo, loan: loanInfo };

  const loanData = loanToData(loan, member.preferredPaymentDay);
  const missed = getMissedPaymentsCount(loanData, asOfDate);
  const paymentDay = isPaymentDayToday(loan.paymentFrequency, member.preferredPaymentDay, asOfDate);

  let type: CollectionAttemptType | null = input.type ?? null;
  if (type === null) {
    if (missed >= COLLECTION_CALL_MIN_MISSED) type = AttemptType.COLLECTION_CALL;
    else if (missed >= COLLECTION_OVERDUE_MIN_MISSED) type = AttemptType.OVERDUE_NOTICE;
    else if (missed === 0 && paymentDay) type = AttemptType.PAYMENT_REMINDER;
    else {
      return {
        success: false,
        loanId: loan.loanId,
        type: AttemptType.PAYMENT_REMINDER,
        channel: Channel.WHATSAPP,
        memberName: member.name,
        dryRun: false,
        error:
          "No collection action applies for this loan today (0 missed, not payment day). Use type override to force one."
      };
    }
  }

  const channel: CollectionChannel = input.channel ?? defaultChannelForType(type);

  if (dryRun) {
    const templateName =
      type === AttemptType.PAYMENT_REMINDER
        ? getPaymentReminderTemplateName()
        : type === AttemptType.OVERDUE_NOTICE
          ? getOverdueNoticeTemplateName()
          : undefined;
    logDryRun({
      channel,
      type,
      target,
      templateName: templateName ?? undefined,
      missedPayments: type !== AttemptType.PAYMENT_REMINDER ? missed : 0
    });
    return {
      success: true,
      loanId: loan.loanId,
      type,
      channel,
      memberName: member.name,
      dryRun: true
    };
  }

  let ok = false;

  if (type === AttemptType.PAYMENT_REMINDER) {
    const templateName = getPaymentReminderTemplateName();
    if (!templateName) {
      return {
        success: false,
        loanId: loan.loanId,
        type,
        channel,
        memberName: member.name,
        dryRun: false,
        error: "Payment reminder template not configured"
      };
    }
    const paymentDayStr = formatPaymentDayForTemplate(
      loan.paymentFrequency,
      member.preferredPaymentDay
    );
    ok = await executeCollectionAction(
      async () => {
        const res = await deps.sendWhatsAppTemplate({
          phone: member.phone,
          templateName,
          languageCode: "es",
          bodyParameters: [paymentDayStr]
        });
        return res.messages?.[0]?.id ?? null;
      },
      deps.db,
      { target, channel, type, templateName, missedPayments: 0 }
    );
  } else if (type === AttemptType.OVERDUE_NOTICE) {
    const templateName = getOverdueNoticeTemplateName();
    if (!templateName) {
      return {
        success: false,
        loanId: loan.loanId,
        type,
        channel,
        memberName: member.name,
        dryRun: false,
        error: "Overdue notice template not configured"
      };
    }
    ok = await executeCollectionAction(
      async () => {
        const res = await deps.sendWhatsAppTemplate({
          phone: member.phone,
          templateName,
          languageCode: getWhatsAppLanguageCode(),
          bodyParameters: []
        });
        return res.messages?.[0]?.id ?? null;
      },
      deps.db,
      { target, channel, type, templateName, missedPayments: missed }
    );
  } else {
    ok = await executeCollectionAction(
      async () => {
        const { ref } = await initiateCollectionCall({
          phone: member.phone,
          loan: {
            loanId: loan.loanId,
            principal: Number(loan.principal),
            termLength: loan.termLength,
            paymentAmount: Number(loan.paymentAmount),
            paymentFrequency: loan.paymentFrequency,
            missedPayments: missed,
            memberName: member.name
          }
        });
        return ref;
      },
      deps.db,
      { target, channel, type, missedPayments: missed }
    );
  }

  return {
    success: ok,
    loanId: loan.loanId,
    type,
    channel,
    memberName: member.name,
    dryRun: false
  };
}
