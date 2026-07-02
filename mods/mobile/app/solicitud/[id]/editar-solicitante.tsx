/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04 Editar · Solicitante` (Il9kN). Reached from the
 * "SOLICITANTE" section on `datos.tsx`.
 */
import { SolicitudSectionEdit } from "../../../components/SolicitudSectionEdit";
import { SOLICITANTE_FIELDS } from "../../../lib/applicationFields";

export default function EditarSolicitanteScreen() {
  return <SolicitudSectionEdit title="Editar · Solicitante" fields={SOLICITANTE_FIELDS} />;
}
