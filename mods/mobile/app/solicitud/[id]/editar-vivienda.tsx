/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04 Editar · Vivienda` (udAwm). Reached from the
 * "VIVIENDA" section on `datos.tsx`.
 */
import { SolicitudSectionEdit } from "../../../components/SolicitudSectionEdit";
import { VIVIENDA_FIELDS } from "../../../lib/applicationFields";

export default function EditarViviendaScreen() {
  return <SolicitudSectionEdit title="Editar · Vivienda" fields={VIVIENDA_FIELDS} />;
}
