/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { ArrowRight } from "lucide-react";
import { clsx } from "clsx";
import type { ComponentProps, ElementType } from "react";

type PrimaryButtonProps<T extends ElementType = "button"> = {
  as?: T;
  children: React.ReactNode;
  className?: string;
  size?: "default" | "nav";
} & Omit<ComponentProps<T>, "className" | "children">;

export function PrimaryButton<T extends ElementType = "button">({
  as,
  children,
  className,
  size = "default",
  ...rest
}: PrimaryButtonProps<T>) {
  const Comp = as ?? "button";

  return (
    <Comp
      {...(Comp === "button" ? { type: "button" } : {})}
      className={clsx(
        "inline-flex items-center justify-center gap-2.5 rounded-[14px] bg-brand-orange-primary font-semibold text-white transition-colors duration-200 hover:bg-[#ff9f4a] active:bg-[#e67d10] no-underline",
        size === "nav" ? "rounded-xl px-[18px] py-3 text-[15px]" : "px-7 py-[18px] text-[17px]",
        className
      )}
      {...rest}
    >
      {children}
      <ArrowRight className={size === "nav" ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={2} />
    </Comp>
  );
}
