/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Conversation audit card + findings panel (Pencil EzobQ §09). The stories
 * render the pure pieces (card detail inside a FeedCard, the findings view
 * inside the SidePanel); the live wrappers only add the tRPC fetch.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeedCard } from "../components/FeedCard";
import { SidePanel } from "../components/SidePanel";
import type { FeedEvent } from "../components/types";
import { ArrowRight } from "lucide-react";
import { AuditFindingsView, type AuditDetail } from "./ConversationAuditPanel";

const withProblems: FeedEvent = {
  id: "evt-audit-1",
  type: "conversation.audited",
  occurredAt: "2026-09-26T11:00:00Z",
  actorName: "Sistema",
  summary: "Auditoría de conversaciones 3 de 42 conversaciones no cumplen",
  payload: {
    runId: "run-1",
    trigger: "SCHEDULED",
    conversations: 42,
    turns: 186,
    handoffs: 4,
    failedSends: 1,
    flaggedConversations: 3,
    statusText:
      "3 de las 42 conversaciones revisadas no cumplen. Lo más grave: Sofía le dio el puntaje a una solicitante. Además, José no pasó a una persona a quien la pidió y un mensaje de Carmen no se entregó.",
    criticalCount: 1,
    warningCount: 2,
    judged: 42,
    judgeSkipped: 0,
    judgeErrors: 0,
    windowStart: "2026-09-25T11:00:00Z",
    byAgent: [
      {
        agentName: "sofia",
        profile: "APPLICANT",
        agentVersion: "3f2a91c0aa11",
        isNewVersion: true,
        conversations: 18,
        critical: 1,
        warning: 0
      },
      {
        agentName: "jose",
        profile: "PROSPECT",
        agentVersion: "9b07d2e0bb22",
        isNewVersion: false,
        conversations: 9,
        critical: 0,
        warning: 1
      },
      {
        agentName: "carmen",
        profile: "CUSTOMER",
        agentVersion: "c41e8a00cc33",
        isNewVersion: false,
        conversations: 11,
        critical: 0,
        warning: 1
      },
      {
        agentName: "lucia",
        profile: "GUEST",
        agentVersion: "5d3310f0dd44",
        isNewVersion: false,
        conversations: 4,
        critical: 0,
        warning: 0
      }
    ],
    topFinding: {
      severity: "CRITICAL",
      rule: "No revela puntaje, banda, motivos, probabilidades de aprobación ni quién revisa la solicitud.",
      agentName: "sofia",
      personLabel: "Yokasta Medina",
      quote: "Tu puntaje Mikro es 74, así que vas bien para la aprobación.",
      applicationId: "app-485",
      turnAt: "2026-09-26T18:05:00Z"
    }
  }
};

const clean: FeedEvent = {
  id: "evt-audit-2",
  type: "conversation.audited",
  occurredAt: "2026-09-25T20:40:00Z",
  actorName: "Pedro S.",
  summary: "Auditoría de conversaciones las 37 conversaciones cumplen",
  payload: {
    ...withProblems.payload,
    runId: "run-2",
    trigger: "MANUAL",
    conversations: 37,
    turns: 150,
    handoffs: 3,
    failedSends: 0,
    flaggedConversations: 0,
    statusText: "Las 37 conversaciones revisadas cumplen las reglas. 3 pasaron a una persona.",
    criticalCount: 0,
    warningCount: 0,
    byAgent: [
      {
        agentName: "sofia",
        profile: "APPLICANT",
        agentVersion: "3f2a91c0aa11",
        isNewVersion: false,
        conversations: 20,
        critical: 0,
        warning: 0
      },
      {
        agentName: "lucia",
        profile: "GUEST",
        agentVersion: "5d3310f0dd44",
        isNewVersion: false,
        conversations: 17,
        critical: 0,
        warning: 0
      }
    ],
    topFinding: null
  }
};

const detail: AuditDetail = {
  run: {
    id: "run-1",
    trigger: "SCHEDULED",
    actorName: "Sistema",
    status: "DONE",
    startedAt: "2026-09-26T11:00:00Z",
    windowStart: "2026-09-25T11:00:00Z",
    conversations: 42,
    handoffs: 4,
    failedSends: 1,
    criticalCount: 1,
    warningCount: 2,
    judged: 42,
    judgeSkipped: 0,
    judgeErrors: 0
  },
  findings: [
    {
      id: "f1",
      phone: "+18095551001",
      personLabel: "Yokasta Medina",
      applicationId: "app-485",
      customerId: null,
      profile: "APPLICANT",
      agentName: "sofia",
      agentVersion: "3f2a91c0aa11",
      checkId: "no_puntaje",
      source: "JUDGE",
      severity: "CRITICAL",
      rule: "No revela puntaje, banda, motivos, probabilidades de aprobación ni quién revisa la solicitud.",
      evidence: "Tu puntaje Mikro es 74, así que vas bien para la aprobación.",
      reason:
        "Dio el puntaje exacto y una expectativa de aprobación; la regla prohíbe ambas cosas.",
      turn: {
        id: 812,
        role: "AGENT",
        agentName: "sofia",
        failed: false,
        createdAt: "2026-09-26T18:05:00Z"
      }
    },
    {
      id: "f2",
      phone: "+18295552044",
      personLabel: "Ramón Ortiz",
      applicationId: "app-497",
      customerId: null,
      profile: "PROSPECT",
      agentName: "jose",
      agentVersion: "9b07d2e0bb22",
      checkId: "handoff_ignored",
      source: "CODE",
      severity: "WARNING",
      rule: "Pidió una persona y no se traspasó",
      evidence: "quiero hablar con una persona, no con un robot",
      reason: "Pidió hablar con una persona y no se abrió un traspaso.",
      turn: {
        id: 790,
        role: "INBOUND",
        agentName: null,
        failed: false,
        createdAt: "2026-09-25T22:22:00Z"
      }
    },
    {
      id: "f3",
      phone: "+18495553310",
      personLabel: "Franklin Núñez",
      applicationId: null,
      customerId: "cus-1042",
      profile: "CUSTOMER",
      agentName: "carmen",
      agentVersion: "c41e8a00cc33",
      checkId: "failed_send",
      source: "CODE",
      severity: "WARNING",
      rule: "Mensaje no entregado",
      evidence: "Tu saldo pendiente es RD$4,200. Tu próxima cuota vence el viernes.",
      reason: "El envío falló; la persona no recibió la respuesta.",
      turn: {
        id: 801,
        role: "AGENT",
        agentName: "carmen",
        failed: true,
        createdAt: "2026-09-26T13:41:00Z"
      }
    }
  ]
};

const meta = {
  title: "Founder/Audit/ConversationAudit",
  parameters: { layout: "padded" }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The live card's "Ver detalle" link (the live one opens the findings panel). */
const detailLink = (
  <span className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-[#1F4AA8]">
    Ver detalle
    <ArrowRight size={14} />
  </span>
);

export const CardWithProblems: Story = {
  render: () => (
    <div style={{ width: 1100 }}>
      <FeedCard event={withProblems} defaultExpanded hideLinks detailSlot={detailLink} />
    </div>
  )
};

export const CardClean: Story = {
  render: () => (
    <div style={{ width: 1100 }}>
      <FeedCard event={clean} defaultExpanded hideLinks detailSlot={detailLink} />
    </div>
  )
};

export const FindingsPanel: Story = {
  render: () => (
    <SidePanel
      open
      onClose={() => {}}
      title="Auditoría de conversaciones"
      subtitle="26 sep 7:00 · automática · revisó desde 25 sep 7:00"
      iconClassName="bg-ds-amber-bg text-ds-amber"
    >
      <AuditFindingsView detail={detail} onOpenConversation={() => {}} />
    </SidePanel>
  )
};
