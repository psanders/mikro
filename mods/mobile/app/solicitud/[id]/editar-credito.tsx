/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04 Editar · Crédito` (B1vT4). Reached from the "CRÉDITO"
 * section on `datos.tsx`.
 */
import { SolicitudSectionEdit } from "../../../components/SolicitudSectionEdit";
import { CREDITO_FIELDS } from "../../../lib/applicationFields";

export default function EditarCreditoScreen() {
  return <SolicitudSectionEdit title="Editar · Crédito" fields={CREDITO_FIELDS} />;
}
