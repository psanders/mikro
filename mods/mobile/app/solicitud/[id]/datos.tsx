/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04a Datos de la solicitud` (a9LouA): full applicant/
 * business/loan/housing/reference data, documents, and suggested questions,
 * from `trpc.getApplication.useQuery({id})`. Mirrors the desktop
 * `SolicitudDetailPage.tsx` content sections.
 *
 * Sections render flat and always-expanded (no per-section collapse control):
 * progressive disclosure already happens one level up on the "En evaluación"
 * summary. Every section carries an "Editar" link into its dedicated edit
 * screen (Solicitante/Negocio/Crédito/Referencias/Vivienda), hidden once the
 * application is CONVERTED (locked). Documents support capture-based
 * upload/replace/remove for the cédula sides and the signed contract.
 */
import { useState, type ReactNode } from "react";
import { Alert, View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CreditCard, FileText, Info, Pencil } from "lucide-react-native";
import type { ApplicationScore } from "@mikro/common";
import { colors, radii } from "../../../lib/theme";
import { trpc } from "../../../lib/api";
import { Header } from "../../../components/ui/Header";
import { RailCard } from "../../../components/ui/RailCard";
import { KvRow } from "../../../components/ui/KvRow";
import { DocRow } from "../../../components/ui/DocRow";
import { captureIdImageBase64, captureSignedContractPdfBase64 } from "../../../lib/contractPhoto";
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
  editTestID,
  children
}: {
  label: string;
  onEdit?: () => void;
  editTestID?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{label}</Text>
        {onEdit && (
          <Pressable onPress={onEdit} style={styles.editLink} hitSlop={8} testID={editTestID}>
            <Pencil size={13} color={colors.brand.blue.primary} strokeWidth={2} />
            <Text style={styles.editLinkText}>Editar</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export default function SolicitudDatosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const q = trpc.getApplication.useQuery({ id });
  const [capturing, setCapturing] = useState(false);

  const refresh = () => {
    void utils.getApplication.invalidate({ id });
    void utils.listApplications.invalidate();
  };
  const docError = (err: { message: string }) =>
    Alert.alert("Error", `No se pudo actualizar el documento. ${err.message}`);

  // Uploads run through `mutateAsync` inside a try/catch (to also catch camera
  // errors), so they carry no onError; deletes fire-and-forget with onError.
  const uploadId = trpc.uploadIdImage.useMutation({ onSuccess: refresh });
  const deleteId = trpc.deleteIdImage.useMutation({ onSuccess: refresh, onError: docError });
  const uploadContract = trpc.uploadSignedContract.useMutation({ onSuccess: refresh });
  const deleteContract = trpc.deleteApplicationContract.useMutation({
    onSuccess: refresh,
    onError: docError
  });
  const busy =
    capturing ||
    uploadId.isPending ||
    deleteId.isPending ||
    uploadContract.isPending ||
    deleteContract.isPending;

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
  const canEdit = app.status !== "CONVERTED";
  const editHandler = (route: string) =>
    canEdit ? () => router.push(`/solicitud/${id}/${route}`) : undefined;

  async function captureAndUploadIdImage(side: "FRONT" | "BACK") {
    if (busy) return;
    setCapturing(true);
    try {
      const base64 = await captureIdImageBase64();
      if (!base64) return;
      await uploadId.mutateAsync({
        id,
        side,
        originalName: `cedula-${side.toLowerCase()}-${id.slice(0, 8)}.jpg`,
        mimeType: "image/jpeg",
        dataBase64: base64
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      Alert.alert("Error", `No se pudo subir la imagen de la cédula. ${message}`);
    } finally {
      setCapturing(false);
    }
  }

  async function captureAndUploadContract() {
    if (busy) return;
    setCapturing(true);
    try {
      const base64 = await captureSignedContractPdfBase64();
      if (!base64) return;
      await uploadContract.mutateAsync({
        id,
        originalName: `contrato-firmado-${id.slice(0, 8)}.pdf`,
        mimeType: "application/pdf",
        dataBase64: base64
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      Alert.alert("Error", `No se pudo subir el contrato. ${message}`);
    } finally {
      setCapturing(false);
    }
  }

  function confirmRemove(what: string, onConfirm: () => void) {
    if (busy) return;
    Alert.alert("Eliminar documento", `¿Eliminar ${what}? Esta acción no se puede deshacer.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: onConfirm }
    ]);
  }

  return (
    <View style={styles.screen}>
      <Header
        title="Datos de la solicitud"
        subtitle={`${name} · ${st.label}`}
        fallbackRoute="/(evaluator)"
      />
      <ScrollView
        contentContainerStyle={styles.body}
        alwaysBounceVertical
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />
        }
      >
        <Section
          label="SOLICITANTE"
          onEdit={editHandler("editar-solicitante")}
          editTestID="edit-solicitante"
        >
          <KvRow label="Nombre" value={name} />
          <KvRow label="Teléfono" value={app.phone ?? ""} />
          <KvRow label="Cédula" value={app.idNumber ?? ""} />
          <KvRow
            label="Fecha de nacimiento"
            value={app.dateOfBirth ? formatDate(app.dateOfBirth) : ""}
          />
          <KvRow label="Estado civil" value={app.maritalStatus ?? ""} />
        </Section>

        <Section label="NEGOCIO" onEdit={editHandler("editar-negocio")} editTestID="edit-negocio">
          <KvRow label="Tipo de negocio" value={businessTypeLabel(app.businessType)} />
          <KvRow label="Nombre" value={app.businessName ?? ""} />
          <KvRow label="Tiempo operando" value={raw(app, "businessAge")} />
          <KvRow label="Ventas mensuales" value={raw(app, "monthlySales")} />
          <KvRow label="Local" value={raw(app, "locationType")} />
          <KvRow label="Formalización" value={raw(app, "formalization")} />
          <KvRow label="Nº de empleados" value={raw(app, "employeeCount")} />
        </Section>

        <Section label="CRÉDITO" onEdit={editHandler("editar-credito")} editTestID="edit-credito">
          <KvRow label="Monto solicitado" value={formatDop(app.requestedAmount)} />
          <KvRow label="Propósito" value={app.purpose ?? ""} />
          <KvRow
            label="Plazo"
            value={app.requestedTermWeeks ? `${app.requestedTermWeeks} semanas` : ""}
          />
        </Section>

        <Section
          label="REFERENCIAS"
          onEdit={editHandler("editar-referencias")}
          editTestID="edit-referencias"
        >
          <KvRow label="Cónyuge" value={raw(app, "spouseName")} />
          <KvRow label="Tel. cónyuge" value={raw(app, "spousePhone")} />
          <KvRow label="Referencia" value={raw(app, "referenceName")} />
          <KvRow label="Tel. referencia" value={raw(app, "referencePhone")} />
        </Section>

        <Section
          label="VIVIENDA"
          onEdit={editHandler("editar-vivienda")}
          editTestID="edit-vivienda"
        >
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
            onPress={() => void captureAndUploadIdImage("FRONT")}
            onRemove={() =>
              confirmRemove("la cédula (frente)", () => deleteId.mutate({ id, side: "FRONT" }))
            }
            testID="doc-id-front"
            actionTestID="doc-id-front-action"
            removeTestID="doc-id-front-remove"
          />
          <DocRow
            label="Cédula (dorso)"
            icon={CreditCard}
            uploaded={!!app.idBackFilename}
            actionLabel={app.idBackFilename ? "Reemplazar" : "Subir"}
            onPress={() => void captureAndUploadIdImage("BACK")}
            onRemove={() =>
              confirmRemove("la cédula (dorso)", () => deleteId.mutate({ id, side: "BACK" }))
            }
            testID="doc-id-back"
            actionTestID="doc-id-back-action"
            removeTestID="doc-id-back-remove"
          />
          <DocRow
            label="Contrato"
            icon={FileText}
            uploaded={!!app.contractFilename}
            actionLabel={app.contractFilename ? "Reemplazar" : "Subir"}
            onPress={() => void captureAndUploadContract()}
            onRemove={() => confirmRemove("el contrato", () => deleteContract.mutate({ id }))}
            testID="doc-contract"
            actionTestID="doc-contract-action"
            removeTestID="doc-contract-remove"
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
  questionReason: { fontFamily: "Geist_500Medium", fontSize: 12, color: "#697A93" }
});
