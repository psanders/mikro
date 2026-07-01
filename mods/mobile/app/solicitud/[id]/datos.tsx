/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04a Datos de la solicitud` (a9LouA): full applicant/
 * business/loan/housing/reference data, documents, and suggested questions —
 * read-only display of `trpc.getApplication.useQuery({id})`. Mirrors the
 * desktop `SolicitudDetailPage.tsx` content sections.
 *
 * Pencil shows an "Editar" link per section (tap-a-section-to-edit); only the
 * "NEGOCIO" section has a built edit screen so far (`04c Editar · Negocio`,
 * Pencil node `o1Cx54` — task 5.1), so only that section's header carries the
 * edit affordance. The other sections stay collapsible (tap to
 * expand/collapse) instead of editable, matching the previous pass's scope.
 * Documents are shown status-only (no upload/replace/remove — those
 * mutations aren't wired in this pass either). The "Actividad" row is
 * informational only; there's no dedicated activity-detail screen yet.
 */
import { useState, type ReactNode } from "react";
import { Alert, View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Info,
  History,
  Pencil
} from "lucide-react-native";
import type { ApplicationScore } from "@mikro/common";
import { colors, radii } from "../../../lib/theme";
import { trpc } from "../../../lib/api";
import { Header } from "../../../components/ui/Header";
import { RailCard } from "../../../components/ui/RailCard";
import { KvRow } from "../../../components/ui/KvRow";
import { DocRow } from "../../../components/ui/DocRow";
import {
  applicantName,
  businessTypeLabel,
  formatDate,
  formatDop,
  isForbidden,
  provinceLabel,
  statusMeta
} from "../../../lib/applications";

function raw(app: { rawData?: unknown }, key: string): string {
  const v = (app.rawData as Record<string, unknown> | null)?.[key];
  return typeof v === "string" && v.trim() ? v : "";
}

function Section({
  label,
  onEdit,
  children
}: {
  label: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{label}</Text>
        <View style={styles.cardHeaderRight}>
          {onEdit && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              style={styles.editLink}
              hitSlop={8}
              testID="edit-negocio"
            >
              <Pencil size={13} color={colors.brand.blue.primary} strokeWidth={2} />
              <Text style={styles.editLinkText}>Editar</Text>
            </Pressable>
          )}
          {open ? (
            <ChevronUp size={16} color="#697A93" strokeWidth={2} />
          ) : (
            <ChevronDown size={16} color="#697A93" strokeWidth={2} />
          )}
        </View>
      </Pressable>
      {open && <View style={styles.cardBody}>{children}</View>}
    </View>
  );
}

export default function SolicitudDatosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = trpc.getApplication.useQuery({ id });

  if (q.isPending) {
    return (
      <View style={styles.screen}>
        <Header title="Datos de la solicitud" fallbackRoute="/(evaluator)" />
        <Text style={styles.centerText}>Cargando...</Text>
      </View>
    );
  }

  if (q.isError || !q.data) {
    return (
      <View style={styles.screen}>
        <Header title="Datos de la solicitud" fallbackRoute="/(evaluator)" />
        <Text style={styles.centerErrorText}>
          {q.isError && isForbidden(q.error)
            ? "No tienes acceso a esta solicitud."
            : q.isError
              ? q.error.message
              : "Solicitud no encontrada."}
        </Text>
      </View>
    );
  }

  const app = q.data;
  const name = applicantName(app);
  const st = statusMeta(app.status);
  const score = (app.scoreData as ApplicationScore | null) ?? null;
  const notes = score?.evaluator_notes ?? [];

  function handleDocPress() {
    // TODO: read-only for this pass (task 4.2) — upload/replace/remove
    // (`uploadIdImage`/`deleteIdImage`/`uploadSignedContract`) aren't wired.
    Alert.alert("Próximamente", "La gestión de documentos aún no está disponible aquí.");
  }

  return (
    <View style={styles.screen}>
      <Header
        title="Datos de la solicitud"
        subtitle={`${name} · ${st.label}`}
        fallbackRoute="/(evaluator)"
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Section label="SOLICITANTE">
          <KvRow label="Nombre" value={name} />
          <KvRow label="Teléfono" value={app.phone ?? ""} />
          <KvRow label="Cédula" value={app.idNumber ?? ""} />
          <KvRow
            label="Fecha de nacimiento"
            value={app.dateOfBirth ? formatDate(app.dateOfBirth) : ""}
          />
          <KvRow label="Estado civil" value={app.maritalStatus ?? ""} />
        </Section>

        <Section
          label="NEGOCIO"
          onEdit={
            app.status !== "CONVERTED"
              ? () => router.push(`/solicitud/${id}/editar-negocio`)
              : undefined
          }
        >
          <KvRow label="Tipo de negocio" value={businessTypeLabel(app.businessType)} />
          <KvRow label="Nombre" value={app.businessName ?? ""} />
          <KvRow label="Tiempo operando" value={raw(app, "businessAge")} />
          <KvRow label="Ventas mensuales" value={raw(app, "monthlySales")} />
          <KvRow label="Local" value={raw(app, "locationType")} />
          <KvRow label="Formalización" value={raw(app, "formalization")} />
          <KvRow label="Nº de empleados" value={raw(app, "employeeCount")} />
        </Section>

        <Section label="CRÉDITO">
          <KvRow label="Monto solicitado" value={formatDop(app.requestedAmount)} />
          <KvRow label="Propósito" value={app.purpose ?? ""} />
          <KvRow
            label="Plazo"
            value={app.requestedTermWeeks ? `${app.requestedTermWeeks} semanas` : ""}
          />
        </Section>

        <Section label="REFERENCIAS">
          <KvRow label="Cónyuge" value={raw(app, "spouseName")} />
          <KvRow label="Tel. cónyuge" value={raw(app, "spousePhone")} />
          <KvRow label="Referencia" value={raw(app, "referenceName")} />
          <KvRow label="Tel. referencia" value={raw(app, "referencePhone")} />
        </Section>

        <Section label="VIVIENDA">
          <KvRow label="Tipo de vivienda" value={raw(app, "housingType")} />
          <KvRow label="Tiempo residiendo" value={raw(app, "residenceTime")} />
          <KvRow label="Dirección" value={app.homeAddress ?? ""} />
          <KvRow label="Provincia" value={provinceLabel(app.province)} />
          <KvRow label="Referencia" value={raw(app, "addressReference")} />
        </Section>

        <RailCard label="DOCUMENTOS">
          <DocRow
            label="Cédula (frente)"
            icon={CreditCard}
            uploaded={!!app.idFrontFilename}
            actionLabel={app.idFrontFilename ? "Reemplazar" : "Subir"}
            onPress={handleDocPress}
          />
          <DocRow
            label="Cédula (dorso)"
            icon={CreditCard}
            uploaded={!!app.idBackFilename}
            actionLabel={app.idBackFilename ? "Reemplazar" : "Subir"}
            onPress={handleDocPress}
          />
          <DocRow
            label="Contrato"
            icon={FileText}
            uploaded={!!app.contractFilename}
            actionLabel={app.contractFilename ? "Reemplazar" : "Subir"}
            onPress={handleDocPress}
          />
        </RailCard>

        {notes.length > 0 && (
          <RailCard label="PREGUNTAS SUGERIDAS">
            {notes.map((n, i) => (
              <View key={i} style={styles.question}>
                <Info size={16} color="#697A93" strokeWidth={2} style={{ marginTop: 1 }} />
                <View style={styles.questionBody}>
                  <Text style={styles.questionTopic}>{n.topic}</Text>
                  <Text style={styles.questionText}>{n.question}</Text>
                  {n.reason ? <Text style={styles.questionReason}>{n.reason}</Text> : null}
                </View>
              </View>
            ))}
          </RailCard>
        )}

        <View style={styles.activity}>
          <History size={15} color={colors.brand.blue.primary} strokeWidth={2} />
          <Text style={styles.activityTitle}>Actividad</Text>
          <Text style={styles.activityMeta}>
            {app.reviewedAt ? `· última ${formatDate(app.reviewedAt)}` : "· sin actividad"}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 14 },
  centerText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    paddingVertical: 40
  },
  centerErrorText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.brand.orange.deep,
    textAlign: "center",
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  card: {
    borderRadius: radii.lg,
    backgroundColor: colors.brand.white,
    borderWidth: 1,
    borderColor: colors.border.card,
    overflow: "hidden"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18
  },
  cardLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#697A93"
  },
  cardHeaderRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  editLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  editLinkText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    color: colors.brand.blue.primary
  },
  cardBody: { paddingHorizontal: 18, paddingBottom: 18, gap: 14 },
  question: { flexDirection: "row", gap: 10 },
  questionBody: { flex: 1, gap: 2 },
  questionTopic: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.4,
    color: "#697A93"
  },
  questionText: { fontFamily: "Geist_500Medium", fontSize: 13, color: colors.brand.ink },
  questionReason: { fontFamily: "Geist_500Medium", fontSize: 12, color: "#697A93" },
  activity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4
  },
  activityTitle: {
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: colors.brand.blue.primary
  },
  activityMeta: { fontFamily: "Geist_500Medium", fontSize: 13, color: colors.text.secondary }
});
