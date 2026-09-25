/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useMemo } from "react";
import type { TransitionActor } from "@mikro/common/schemas";
import { trpc } from "../../lib/trpc";

export interface Viewer extends TransitionActor {
  name: string;
  isAdmin: boolean;
  isReviewer: boolean;
}

/** The signed-in person as the review rules see them (id + roles). */
export function useViewer(): Viewer | null {
  const whoami = trpc.whoami.useQuery();
  return useMemo(() => {
    const d = whoami.data;
    if (!d) return null;
    const roles = (d.roles ?? []) as TransitionActor["roles"];
    return {
      id: d.id,
      name: d.name,
      roles,
      isAdmin: roles.includes("ADMIN"),
      isReviewer: roles.includes("REVIEWER") || roles.includes("ADMIN")
    };
  }, [whoami.data]);
}
