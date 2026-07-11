/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The live copilot dock (design add-founder-copilot, task 4.1). Renders the
 * presentational `CopilotDock` and wires it to tRPC:
 *   - loads `getCopilotHistory` on open and merges messages + pending actions
 *     chronologically into the thread (pending-action cards render from their
 *     records with their live status);
 *   - `copilotChat` sends with an optimistic user bubble + typing indicator,
 *     then appends the reply / pending action / created rule as the matching
 *     component;
 *   - `copilotConfirmAction` / `copilotRejectAction` update the card in place
 *     and invalidate the feed (a confirmed action becomes a feed event);
 *   - rule cards disable via `setWatchRuleEnabled`; "Editar regla" prefills the
 *     composer. Conversational errors surface as an assistant-style error
 *     message, never a toast. The one exception is the loan-card contract
 *     download: saving the PDF is an OS-level file action (not a copilot turn),
 *     so its "saved to …" confirmation uses the global toast — the same one the
 *     reports screen raises for the identical save.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "../../lib/trpc";
import type { RouterOutputs } from "../../lib/trpc";
import { base64ToBytes, saveFile, savedMessage, SAVED_TOAST_MS } from "../../lib/saveFile";
import { useToast } from "../../components/ui/ToastProvider";
import { AssistantMessage } from "./AssistantMessage";
import { CapabilityChips } from "./CapabilityChips";
import { CopilotDock } from "./CopilotDock";
import { useCopilot } from "./CopilotContext";
import { PendingActionCard } from "./PendingActionCard";
import { RuleCard } from "./RuleCard";
import { CustomerFormCard } from "./CustomerFormCard";
import { LoanFormCard } from "./LoanFormCard";
import { DocumentCard, type DocumentDownloadStatus } from "./DocumentCard";
import { UserBubble } from "./UserBubble";
import type {
  CopilotMessage,
  CopilotPendingAction,
  CopilotProvenance,
  CopilotRule,
  CreateFormStatus,
  CustomerFormValues,
  CustomerPickerResult,
  LoanFormValues,
  PendingActionState
} from "./types";

type HistoryResult = RouterOutputs["getCopilotHistory"];
type ChatReply = RouterOutputs["copilotChat"];

/** An assistant-style error turn, kept local so it never touches the wire types. */
interface ErrorMessage {
  kind: "error";
  id: string;
  text: string;
}

type ThreadItem = CopilotMessage | ErrorMessage;

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

function statusToState(status: string): PendingActionState {
  switch (status) {
    case "CONFIRMED":
      return "confirmed";
    case "REJECTED":
      return "rejected";
    case "EXPIRED":
      return "expired";
    default:
      return "pending";
  }
}

/** Merge persisted messages + pending actions into one time-ordered thread. */
function buildThread(data: HistoryResult): ThreadItem[] {
  const dated: Array<{ at: number; item: ThreadItem }> = [];

  for (const m of data.messages) {
    const at = new Date(m.createdAt).getTime();
    if (m.role === "HUMAN") {
      dated.push({ at, item: { kind: "user", id: m.id, text: m.content } });
    } else {
      dated.push({ at, item: { kind: "assistant", id: m.id, text: m.content } });
    }
  }

  for (const p of data.pendingActions) {
    dated.push({
      at: new Date(p.createdAt).getTime(),
      item: {
        kind: "pendingAction",
        id: `pa-${p.id}`,
        action: {
          id: p.id,
          toolName: p.toolName,
          args: p.args,
          summary: p.summary,
          status: p.status as CopilotPendingAction["status"],
          createdAt: new Date(p.createdAt)
        },
        state: statusToState(p.status)
      }
    });
  }

  dated.sort((a, b) => a.at - b.at);
  return dated.map((d) => d.item);
}

function toRule(created: NonNullable<ChatReply["createdRule"]>): CopilotRule {
  return {
    id: created.id,
    name: created.name,
    metric: created.metric,
    comparator: created.comparator,
    threshold: created.threshold,
    enabled: true
  };
}

export function CopilotDockContainer() {
  const { open, prefill, close } = useCopilot();
  const utils = trpc.useUtils();
  const toast = useToast();

  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [input, setInput] = useState("");
  const seededRef = useRef(false);

  const history = trpc.getCopilotHistory.useQuery({}, { enabled: open });

  // Seed the thread once per open from persisted history; both fresh sends and
  // confirm/reject are applied locally afterwards (backend persists them too, so
  // the next open re-seeds cleanly).
  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      return;
    }
    if (seededRef.current) return;
    if (history.data) {
      setThread(buildThread(history.data));
      seededRef.current = true;
    }
  }, [open, history.data]);

  // Consume prefill signals from the header sparkles / ask-chips.
  useEffect(() => {
    if (prefill) setInput(prefill.text);
  }, [prefill]);

  const chat = trpc.copilotChat.useMutation();
  const confirmAction = trpc.copilotConfirmAction.useMutation();
  const rejectAction = trpc.copilotRejectAction.useMutation();
  const setRuleEnabled = trpc.setWatchRuleEnabled.useMutation();
  const clearHistory = trpc.clearCopilotHistory.useMutation();
  const createCustomer = trpc.createCustomer.useMutation();
  const createLoan = trpc.createLoan.useMutation();
  const generateContract = trpc.generateCustomerContract.useMutation();

  // Loan form card's customer picker (the dock holds at most one open form at
  // a time), plus per-card create status keyed by message id.
  const [loanCustomerQuery, setLoanCustomerQuery] = useState("");
  const loanCustomerSearch = trpc.listCustomers.useQuery(
    { search: loanCustomerQuery.trim() },
    { enabled: loanCustomerQuery.trim().length >= 2 }
  );
  const loanFormCustomers: CustomerPickerResult[] = (loanCustomerSearch.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    idNumber: c.idNumber,
    homeAddress: c.homeAddress
  }));

  // Customer form card's collector select — every COLLECTOR-role user.
  const usersQuery = trpc.listUsers.useQuery({ limit: 100 });
  const collectorOptions = useMemo(
    () =>
      (usersQuery.data ?? [])
        .filter((u) => u.roles?.some((r) => r.role === "COLLECTOR"))
        .map((u) => ({ id: u.id, name: u.name })),
    [usersQuery.data]
  );

  const [customerFormStatus, setCustomerFormStatus] = useState<
    Record<string, { status: CreateFormStatus; error?: string }>
  >({});
  const [loanFormStatus, setLoanFormStatus] = useState<
    Record<string, { status: CreateFormStatus; error?: string }>
  >({});
  const [documentStatus, setDocumentStatus] = useState<
    Record<string, { status: DocumentDownloadStatus; error?: string }>
  >({});

  const appendReply = useCallback((res: ChatReply) => {
    setThread((prev) => {
      const next = [...prev];
      const prov: CopilotProvenance | undefined = res.provenance;
      let provUsed = false;
      if (res.reply && res.reply.trim()) {
        next.push({ kind: "assistant", id: uid(), text: res.reply, provenance: prov });
        provUsed = true;
      }
      if (res.pendingAction) {
        next.push({
          kind: "pendingAction",
          id: uid(),
          action: { ...res.pendingAction, createdAt: new Date(res.pendingAction.createdAt) },
          state: "pending",
          provenance: provUsed ? undefined : prov
        });
        provUsed = true;
      }
      if (res.createdRule) {
        next.push({
          kind: "rule",
          id: uid(),
          rule: toRule(res.createdRule),
          provenance: provUsed ? undefined : prov
        });
        provUsed = true;
      }
      if (res.customerForm) {
        next.push({ kind: "customerForm", id: uid(), provenance: provUsed ? undefined : prov });
        provUsed = true;
      }
      if (res.loanForm) {
        next.push({
          kind: "loanForm",
          id: uid(),
          customerHint: res.loanForm.customerHint,
          provenance: provUsed ? undefined : prov
        });
        provUsed = true;
      }
      if (res.document) {
        next.push({
          kind: "document",
          id: uid(),
          document: res.document,
          provenance: provUsed ? undefined : prov
        });
      }
      return next;
    });
  }, []);

  const appendError = useCallback((message: string) => {
    setThread((prev) => [...prev, { kind: "error", id: uid(), text: message }]);
  }, []);

  const handleSend = useCallback(
    (message: string) => {
      setThread((prev) => [...prev, { kind: "user", id: uid(), text: message }]);
      setInput("");
      chat.mutate(
        { message },
        {
          onSuccess: (res) => appendReply(res),
          onError: (err) =>
            appendError(err.message || "No pude procesar tu mensaje. Inténtalo de nuevo.")
        }
      );
    },
    [chat, appendReply, appendError]
  );

  const setActionState = useCallback((actionId: string, state: PendingActionState) => {
    setThread((prev) =>
      prev.map((item) =>
        item.kind === "pendingAction" && item.action.id === actionId ? { ...item, state } : item
      )
    );
  }, []);

  const handleConfirm = useCallback(
    (action: CopilotPendingAction) => {
      confirmAction.mutate(
        { actionId: action.id },
        {
          onSuccess: (res) => {
            setActionState(action.id, "confirmed");
            if (res.reply && res.reply.trim()) {
              setThread((prev) => [...prev, { kind: "assistant", id: uid(), text: res.reply }]);
            }
            void utils.listFeedEvents.invalidate();
          },
          onError: (err) => appendError(err.message || "No se pudo confirmar la acción.")
        }
      );
    },
    [confirmAction, setActionState, appendError, utils]
  );

  const handleReject = useCallback(
    (action: CopilotPendingAction) => {
      rejectAction.mutate(
        { actionId: action.id },
        {
          onSuccess: () => setActionState(action.id, "rejected"),
          onError: (err) => appendError(err.message || "No se pudo rechazar la acción.")
        }
      );
    },
    [rejectAction, setActionState, appendError]
  );

  const handleRuleDisable = useCallback(
    (rule: CopilotRule) => {
      const nextEnabled = !(rule.enabled ?? true);
      setRuleEnabled.mutate(
        { id: rule.id, enabled: nextEnabled },
        {
          onSuccess: () => {
            setThread((prev) =>
              prev.map((item) =>
                item.kind === "rule" && item.rule.id === rule.id
                  ? { ...item, rule: { ...item.rule, enabled: nextEnabled } }
                  : item
              )
            );
          },
          onError: (err) => appendError(err.message || "No se pudo actualizar la regla.")
        }
      );
    },
    [setRuleEnabled, appendError]
  );

  const handleRuleEdit = useCallback((rule: CopilotRule) => {
    setInput(`Edita la regla ${rule.name}: `);
  }, []);

  const handleCreateCustomer = useCallback(
    (messageId: string, values: CustomerFormValues) => {
      setCustomerFormStatus((prev) => ({ ...prev, [messageId]: { status: "creating" } }));
      createCustomer.mutate(values, {
        onSuccess: () => {
          setCustomerFormStatus((prev) => ({ ...prev, [messageId]: { status: "done" } }));
          void utils.listFeedEvents.invalidate();
        },
        onError: (err) =>
          setCustomerFormStatus((prev) => ({
            ...prev,
            [messageId]: {
              status: "error",
              error: err.message || "No se pudo crear el cliente. Inténtalo de nuevo."
            }
          }))
      });
    },
    [createCustomer, utils]
  );

  const handleCreateLoan = useCallback(
    (messageId: string, values: LoanFormValues) => {
      setLoanFormStatus((prev) => ({ ...prev, [messageId]: { status: "creating" } }));
      const { generateContract: shouldGenerateContract, ...loanInput } = values;
      createLoan.mutate(loanInput, {
        onSuccess: () => {
          void utils.listFeedEvents.invalidate();
          if (!shouldGenerateContract) {
            setLoanFormStatus((prev) => ({ ...prev, [messageId]: { status: "done" } }));
            return;
          }
          generateContract.mutate(
            {
              customerId: values.customerId,
              principal: values.principal,
              installments: values.termLength,
              installmentAmount: values.paymentAmount,
              frequency: values.paymentFrequency,
              startDate: values.startingDate || new Date().toISOString().slice(0, 10)
            },
            {
              onSuccess: (contract) => {
                setLoanFormStatus((prev) => ({ ...prev, [messageId]: { status: "done" } }));
                // Save the contract PDF and confirm WHERE it landed — the
                // desktop build writes silently to Downloads, so without this
                // toast the founder has no signal the contract was produced.
                void (async () => {
                  try {
                    const saved = await saveFile(
                      base64ToBytes(contract.dataBase64),
                      contract.filename,
                      contract.mimeType
                    );
                    toast.success(savedMessage("Contrato", saved, contract.filename), {
                      durationMs: SAVED_TOAST_MS
                    });
                  } catch {
                    toast.error(
                      "El préstamo se creó y el contrato se generó, pero no se pudo guardar el archivo."
                    );
                  }
                })();
                void utils.listFeedEvents.invalidate();
              },
              onError: (err) =>
                setLoanFormStatus((prev) => ({
                  ...prev,
                  [messageId]: {
                    status: "error",
                    error:
                      err.message ||
                      "El préstamo se creó, pero no se pudo generar el contrato. Inténtalo de nuevo desde ctl."
                  }
                }))
            }
          );
        },
        onError: (err) =>
          setLoanFormStatus((prev) => ({
            ...prev,
            [messageId]: {
              status: "error",
              error: err.message || "No se pudo crear el préstamo. Inténtalo de nuevo."
            }
          }))
      });
    },
    [createLoan, generateContract, utils, toast]
  );

  const handleDownloadDocument = useCallback(
    (messageId: string, document: { filename: string; mimeType: string; base64: string }) => {
      setDocumentStatus((prev) => ({ ...prev, [messageId]: { status: "saving" } }));
      void (async () => {
        try {
          const saved = await saveFile(
            base64ToBytes(document.base64),
            document.filename,
            document.mimeType
          );
          setDocumentStatus((prev) => ({ ...prev, [messageId]: { status: "done" } }));
          toast.success(savedMessage("Documento", saved, document.filename), {
            durationMs: SAVED_TOAST_MS
          });
        } catch {
          setDocumentStatus((prev) => ({
            ...prev,
            [messageId]: {
              status: "error",
              error: "No se pudo guardar el archivo. Inténtalo de nuevo."
            }
          }));
        }
      })();
    },
    [toast]
  );

  const handleClearHistory = useCallback(() => {
    clearHistory.mutate(
      {},
      {
        onSuccess: () => {
          setThread([]);
          void utils.getCopilotHistory.invalidate();
        },
        onError: (err) =>
          appendError(err.message || "No se pudo borrar el historial. Inténtalo de nuevo.")
      }
    );
  }, [clearHistory, appendError, utils]);

  if (!open) return null;

  const busy = chat.isPending;
  const showChips = seededRef.current && thread.length === 0 && !busy;

  return (
    <CopilotDock
      value={input}
      onChange={setInput}
      onSend={handleSend}
      onClose={close}
      busy={busy}
      onClearHistory={handleClearHistory}
      clearing={clearHistory.isPending}
    >
      {showChips && <CapabilityChips onPick={setInput} />}
      {thread.map((item) => {
        switch (item.kind) {
          case "user":
            return <UserBubble key={item.id} text={item.text} />;
          case "assistant":
            return <AssistantMessage key={item.id} text={item.text} provenance={item.provenance} />;
          case "error":
            return (
              <div
                key={item.id}
                className="w-full break-words rounded-[12px] border border-[#F3D2D2] bg-[#FEF6F6] px-[14px] py-[11px] text-[13px] font-medium leading-[20px] text-[#B42121]"
              >
                {item.text}
              </div>
            );
          case "pendingAction":
            return (
              <AssistantMessage key={item.id} provenance={item.provenance}>
                <PendingActionCard
                  action={item.action}
                  state={item.state}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                />
              </AssistantMessage>
            );
          case "rule":
            return (
              <AssistantMessage key={item.id} provenance={item.provenance}>
                <RuleCard
                  rule={item.rule}
                  note={item.note}
                  onEdit={handleRuleEdit}
                  onDisable={handleRuleDisable}
                />
              </AssistantMessage>
            );
          case "customerForm":
            return (
              <AssistantMessage key={item.id} provenance={item.provenance}>
                <CustomerFormCard
                  collectors={collectorOptions}
                  onCreate={(values) => handleCreateCustomer(item.id, values)}
                  status={customerFormStatus[item.id]?.status ?? "idle"}
                  error={customerFormStatus[item.id]?.error}
                />
              </AssistantMessage>
            );
          case "loanForm":
            return (
              <AssistantMessage key={item.id} provenance={item.provenance}>
                <LoanFormCard
                  customers={loanFormCustomers}
                  customerHint={item.customerHint}
                  onSearch={setLoanCustomerQuery}
                  onCreate={(values) => handleCreateLoan(item.id, values)}
                  status={loanFormStatus[item.id]?.status ?? "idle"}
                  error={loanFormStatus[item.id]?.error}
                />
              </AssistantMessage>
            );
          case "document":
            return (
              <AssistantMessage key={item.id} provenance={item.provenance}>
                <DocumentCard
                  filename={item.document.filename}
                  status={documentStatus[item.id]?.status ?? "idle"}
                  error={documentStatus[item.id]?.error}
                  onDownload={() => handleDownloadDocument(item.id, item.document)}
                />
              </AssistantMessage>
            );
          default:
            return null;
        }
      })}
    </CopilotDock>
  );
}
