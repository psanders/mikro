/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04 Editar · Referencias` (FC6R3). Reached from the
 * "REFERENCIAS" section on `datos.tsx`.
 */
import { SolicitudSectionEdit } from "../../../components/SolicitudSectionEdit";
import { REFERENCIAS_FIELDS } from "../../../lib/applicationFields";

export default function EditarReferenciasScreen() {
  return <SolicitudSectionEdit title="Editar · Referencias" fields={REFERENCIAS_FIELDS} />;
}
