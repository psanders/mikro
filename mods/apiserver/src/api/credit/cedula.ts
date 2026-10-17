/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Applications and customers store the cédula as typed (with or without
 * dashes). Credit reports always use ###-#######-#. These helpers bridge both.
 */
import { normalizeCedula } from "@mikro/score";

/** Every stored spelling that means this cédula. */
export function cedulaVariants(cedula: string): string[] {
  const n = normalizeCedula(cedula);
  if (!n) return [cedula];
  return [n, n.replace(/-/g, "")];
}

export { normalizeCedula };
