/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Data wiring for task feed cards: fetches the firing's live state by the
 * `taskFiringId` in the event payload (the ONLY live fetch a feed card makes —
 * the event row itself renders standalone), and mounts the TaskActionCard
 * widget while the firing is open. A resolved firing, a missing id, or a
 * failed fetch all degrade to a plain FeedCard row, never blocking the feed.
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { saveFile } from "../lib/saveFile";
import { FeedCard, type FeedCardProps } from "./components/FeedCard";
import {
  TaskActionCard,
  type TaskFiringInfo,
  type TaskResultAttachment
} from "./components/TaskActionCard";
import { useToast } from "../components/ui/ToastProvider";

export type TaskFeedCardProps = Omit<FeedCardProps, "tint" | "actionSlot" | "defaultExpanded">;

/** Decode a base64 string (as returned by confirmFiring) into raw bytes for saveFile. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function TaskFeedCard(props: TaskFeedCardProps) {
  const { event } = props;
  const toast = useToast();
  const utils = trpc.useUtils();
  const [error, setError] = useState<string | null>(null);
  // Confirm resolves the firing (its live query flips to DONE and the card
  // would normally fall back to a plain row) but a loan-statement confirm
  // carries its PDF back only in the mutation result — captured here so the
  // download button survives the firing going resolved. Never persisted.
  const [resolved, setResolved] = useState<{
    firing: TaskFiringInfo;
    attachment: TaskResultAttachment;
  } | null>(null);

  const taskFiringId =
    typeof event.payload.taskFiringId === "string" ? event.payload.taskFiringId : null;

  const firingQuery = trpc.tasks.getFiring.useQuery(
    { id: taskFiringId ?? "" },
    { enabled: taskFiringId !== null, retry: 1 }
  );

  const invalidate = () => {
    void utils.tasks.getFiring.invalidate({ id: taskFiringId ?? "" });
    void utils.listFeedEvents.invalidate();
  };

  const firing = firingQuery.data;
  const info: TaskFiringInfo | null =
    firing && (firing.status === "READY" || firing.status === "NEEDS_INPUT")
      ? {
          id: firing.id,
          taskName: firing.taskName,
          automationId: firing.automationId,
          status: firing.status,
          askSlots: firing.askSlots,
          missingSlots: firing.missingSlots,
          context: firing.context as Record<string, unknown>,
          payload: firing.payload as Record<string, unknown>,
          reason: firing.reason
        }
      : null;
  const isOpen = info !== null;

  async function handleDownload(attachment: TaskResultAttachment) {
    try {
      await saveFile(base64ToBytes(attachment.base64), attachment.filename, attachment.mimeType);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo descargar el estado de cuenta.");
    }
  }

  const confirm = trpc.tasks.confirmFiring.useMutation({
    onSuccess: (result) => {
      setError(null);
      if (result.status === "DONE") toast.success(result.summary);
      else toast.error(result.summary);
      if (result.status === "DONE" && result.attachment && info) {
        setResolved({ firing: info, attachment: result.attachment });
      }
      invalidate();
    },
    onError: (err) => setError(err.message || "No se pudo confirmar la tarea.")
  });

  const skip = trpc.tasks.skipFiring.useMutation({
    onSuccess: () => {
      setError(null);
      toast.success("Tarea omitida.");
      invalidate();
    },
    onError: (err) => setError(err.message || "No se pudo omitir la tarea.")
  });

  if (!isOpen) {
    if (resolved) {
      // The firing resolved with an in-memory document — keep the card open
      // with just the download action, no confirm/skip form.
      return (
        <FeedCard
          {...props}
          key={`resolved-${resolved.firing.id}`}
          defaultExpanded
          actionSlot={
            <TaskActionCard
              firing={resolved.firing}
              resultAttachment={resolved.attachment}
              onDownloadAttachment={() => handleDownload(resolved.attachment)}
            />
          }
        />
      );
    }
    // Resolved (no attachment), unknown, or unreachable → plain event row.
    return <FeedCard {...props} />;
  }

  const busy = confirm.isPending || skip.isPending;

  return (
    <FeedCard
      {...props}
      // Remount when the firing loads: the plain row above may already have
      // mounted (query in flight), and defaultExpanded only applies at mount.
      key={`open-${info!.id}`}
      defaultExpanded
      tint="amber"
      actionSlot={
        <TaskActionCard
          firing={info!}
          submitting={busy}
          error={error}
          onConfirm={(values) => confirm.mutate({ id: info!.id, askValues: values })}
          onSkip={() => skip.mutate({ id: info!.id })}
        />
      }
    />
  );
}
