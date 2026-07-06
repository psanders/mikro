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
import { FeedCard, type FeedCardProps } from "./components/FeedCard";
import { TaskActionCard, type TaskFiringInfo } from "./components/TaskActionCard";
import { useToast } from "../components/ui/ToastProvider";

export type TaskFeedCardProps = Omit<FeedCardProps, "tint" | "actionSlot" | "defaultExpanded">;

export function TaskFeedCard(props: TaskFeedCardProps) {
  const { event } = props;
  const toast = useToast();
  const utils = trpc.useUtils();
  const [error, setError] = useState<string | null>(null);

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

  const confirm = trpc.tasks.confirmFiring.useMutation({
    onSuccess: (result) => {
      setError(null);
      if (result.status === "DONE") toast.success(result.summary);
      else toast.error(result.summary);
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

  const firing = firingQuery.data;

  if (!firing || (firing.status !== "READY" && firing.status !== "NEEDS_INPUT")) {
    // Resolved, unknown, or unreachable → plain event row.
    return <FeedCard {...props} />;
  }

  const info: TaskFiringInfo = {
    id: firing.id,
    taskName: firing.taskName,
    automationId: firing.automationId,
    status: firing.status,
    askSlots: firing.askSlots,
    missingSlots: firing.missingSlots,
    context: firing.context as Record<string, unknown>,
    reason: firing.reason
  };

  const busy = confirm.isPending || skip.isPending;

  return (
    <FeedCard
      {...props}
      // Remount when the firing loads: the plain row above may already have
      // mounted (query in flight), and defaultExpanded only applies at mount.
      key={`open-${firing.id}`}
      defaultExpanded
      tint="amber"
      actionSlot={
        <TaskActionCard
          firing={info}
          submitting={busy}
          error={error}
          onConfirm={(values) => confirm.mutate({ id: firing.id, askValues: values })}
          onSkip={() => skip.mutate({ id: firing.id })}
        />
      }
    />
  );
}
