/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { InputHTMLAttributes } from "react";
import { Search as SearchIcon } from "lucide-react";
import { cn } from "../../lib/cn";

type SearchProps = InputHTMLAttributes<HTMLInputElement>;

// Mirrors Pencil cp/search: bordered surface box (radius 8, padding 10×14, gap 10)
// with a 16px ds.muted search icon and 14px/500 input.
export function Search({ className, placeholder = "Buscar…", ...props }: SearchProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-[10px] rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[10px]",
        "focus-within:border-brand-blue-sky",
        className
      )}
    >
      <SearchIcon size={16} className="shrink-0 text-ds-muted" />
      <input
        type="search"
        placeholder={placeholder}
        className="w-full bg-transparent text-sm font-medium text-brand-ink outline-none placeholder:text-ds-muted"
        {...props}
      />
    </div>
  );
}
