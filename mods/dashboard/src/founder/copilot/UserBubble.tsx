/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A right-aligned founder message — Pencil `user`: solid blue bubble with the
 * asymmetric corner (14/14/4/14) that points back to the sender.
 */
import { cn } from "../../lib/cn";

export interface UserBubbleProps {
  text: string;
  className?: string;
}

export function UserBubble({ text, className }: UserBubbleProps) {
  return (
    <div className={cn("flex w-full justify-end", className)}>
      <div className="w-fit max-w-[85%] rounded-[14px_14px_4px_14px] bg-[#1F4AA8] px-[14px] py-[10px] text-[13px] font-medium leading-snug text-white">
        {text}
      </div>
    </div>
  );
}
