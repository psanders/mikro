/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04 Solicitud` flow (Vtr3b En evaluación, Dl54V Aprobada,
 * rVxmT Firmada, c4JQN Convertida): Mikro Score card, pipeline progress, and a
 * status-driven action rail. Ported from the desktop `SolicitudDetailPage.tsx`
 * action rail onto a single-column mobile layout. All four Pencil frames are
 * the same status pipeline for one application, so they're rendered as
 * conditional sections of this single `/solicitud/[id]` route rather than as
 * separate routes — matching how `allowedActions()` already drives which
 * cards render.
 *
 * Claim/Approve/Reject-navigation/contract-generate-navigation/camera-upload/
 * convert-navigation/reopen are wired here (task groups 6-8). "Descartar
 * solicitud" routes to the `04j` confirm screen (`descartar.tsx`), which calls
 * `deleteApplication`.
 */
import { useState } from "react";
import {
  Alert,
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  RefreshControl
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CircleCheckBig,
  CircleDot,
  Circle,
  ArrowRight,
  ChartColumn,
  UserCheck,
  User,
  Check,
  FileText,
  FileDown,
  Upload,
  RotateCcw,
  Trash2
} from "lucide-react-native";
import type { ApplicationScore } from "@mikro/common";
import { colors } from "../../lib/theme";
import { trpc } from "../../lib/api";
import { Header } from "../../components/ui/Header";
import { RailCard } from "../../components/ui/RailCard";
import { ScoreSummary } from "../../components/ui/ScoreSummary";
import { BreakdownBar } from "../../components/ui/BreakdownBar";
import { KvRow } from "../../components/ui/KvRow";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { Divider } from "../../components/ui/Divider";
import { ListTile } from "../../components/ui/ListTile";
import { BtnOutline } from "../../components/ui/BtnOutline";
import { BtnCta } from "../../components/ui/BtnCta";
import { captureSignedContractPdfBase64 } from "../../lib/contractPhoto";
import { shareContractPdf } from "../../lib/shareContract";
import {
  allowedActions,
  applicantName,
  CATEGORY_LABELS,
  categoryColor,
  confidenceLabel,
  formatDate,
  isForbidden,
  nextHint,
  PIPELINE_STEPS,
  recommendationLabel,
  reopenActionLabel,
  riskBandMeta,
  riskVariantForBand,
  statusMeta
} from "../../lib/applications";

export default function SolicitudDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const q = trpc.getApplication.useQuery({ id });
  const users = trpc.listUsers.useQuery({});
  const [note, setNote] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const refresh = () => {
    void utils.getApplication.invalidate({ id });
    void utils.listApplications.invalidate();
  };
  const noteRefresh = () => {
    setNote("");
    refresh();
  };

  const claim = trpc.claimApplication.useMutation({ onSuccess: refresh });
  const approve = trpc.approveApplication.useMutation({
    onSuccess: noteRefresh,
    onError: (err) => Alert.alert("Error", `No se pudo aprobar la solicitud. ${err.message}`)
  });
  const reopen = trpc.reopenApplication.useMutation({
    onSuccess: noteRefresh,
    onError: (err) => Alert.alert("Error", `No se pudo reabrir la solicitud. ${err.message}`)
  });
  const promote = trpc.promoteApplication.useMutation({
    onSuccess: refresh,
    onError: (err) => Alert.alert("Error", `No se pudo promover el borrador. ${err.message}`)
  });
  const upload = trpc.uploadSignedContract.useMutation({ onSuccess: refresh });
  const busy =
    claim.isPending ||
    approve.isPending ||
    reopen.isPending ||
    promote.isPending ||
    upload.isPending ||
    capturing;

  async function handleUploadSignedContract() {
    setCapturing(true);
    try {
      const base64 = await captureSignedContractPdfBase64();
      if (!base64) return;
      await upload.mutateAsync({
        id,
        originalName: `contrato-firmado-${id.slice(0, 8)}.pdf`,
        mimeType: "application/pdf",
        dataBase64: base64
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      Alert.alert("Error", `No se pudo subir el contrato firmado. ${message}`);
    } finally {
      setCapturing(false);
    }
  }

  async function handleViewContract() {
    try {
      const contract = await utils.getApplicationContract.fetch({ id });
      await shareContractPdf(contract.dataBase64, contract.filename);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      Alert.alert("Error", `No se pudo abrir el contrato. ${message}`);
    }
  }

  if (q.isPending) {
    return (
      <View style={styles.screen}>
        <Header title="Solicitud" fallbackRoute="/(evaluator)" />
        <Text style={styles.centerText}>Cargando...</Text>
      </View>
    );
  }

  if (q.isError || !q.data) {
    return (
      <View style={styles.screen}>
        <Header title="Solicitud" fallbackRoute="/(evaluator)" />
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
  const band = riskBandMeta(app.riskBand);
  const score = (app.scoreData as ApplicationScore | null) ?? null;
  const actions = allowedActions(app.status);
  const userName = new Map((users.data ?? []).map((u) => [u.id, u.name]));
  const assignee = app.reviewedById
    ? (userName.get(app.reviewedById) ?? "Asignado")
    : "Sin asignar";
  const terminal = app.status === "REJECTED";
  const currentIdx = PIPELINE_STEPS.findIndex((s) => s.status === app.status);
  const hint = nextHint(app.status);

  return (
    <View style={styles.screen}>
      <Header
        title={`Solicitud #${app.id.slice(0, 8).toUpperCase()}`}
        subtitle={`${name} · ${st.label}`}
        fallbackRoute="/(evaluator)"
      />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />
        }
      >
        <RailCard label="MIKRO SCORE">
          {app.score != null ? (
            <>
              <ScoreSummary
                name={name}
                business={app.businessName ?? ""}
                riskLabel={band?.label ?? ""}
                riskVariant={riskVariantForBand(app.riskBand)}
                score={app.score}
              />
              {score && (
                <>
                  <KvRow label="Recomendación" value={recommendationLabel(score.recommendation)} />
                  <KvRow label="Confianza" value={confidenceLabel(score.confidence)} />
                  <Pressable
                    style={styles.breakdownToggle}
                    onPress={() => setShowBreakdown((v) => !v)}
                    testID="toggle-breakdown"
                  >
                    <ChartColumn size={15} color={colors.brand.blue.primary} strokeWidth={2} />
                    <Text style={styles.breakdownToggleText}>
                      {showBreakdown ? "Ocultar desglose" : "Ver desglose e indicadores"}
                    </Text>
                  </Pressable>
                  {showBreakdown && (
                    <View style={styles.breakdownList}>
                      {score.categories.map((c) => (
                        <BreakdownBar
                          key={c.category}
                          label={`${CATEGORY_LABELS[c.category] ?? c.category} · ${c.weight}%`}
                          value={`${c.score}/100`}
                          progress={c.score / 100}
                          color={categoryColor(c.score)}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}
              <Divider />
            </>
          ) : (
            <Text style={styles.mutedText}>Sin score todavía.</Text>
          )}
          <SectionLabel>DETALLES</SectionLabel>
          <KvRow label="Asignado a" value={assignee} />
          <KvRow label="Recibida" value={formatDate(app.createdAt)} />
        </RailCard>

        <RailCard label="PROGRESO">
          {terminal ? (
            <Text style={styles.terminalText}>{st.label}</Text>
          ) : (
            <>
              {PIPELINE_STEPS.map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                const Icon = done ? CircleCheckBig : active ? CircleDot : Circle;
                const color = done
                  ? colors.status.success
                  : active
                    ? colors.brand.blue.primary
                    : colors.text.secondary;
                return (
                  <View key={s.status} style={styles.stepRow}>
                    <Icon size={16} color={color} strokeWidth={2} />
                    <Text style={[styles.stepText, (active || done) && styles.stepTextActive]}>
                      {s.label}
                    </Text>
                  </View>
                );
              })}
              {hint && (
                <View style={styles.nextHint}>
                  <ArrowRight size={15} color={colors.brand.blue.primary} strokeWidth={2} />
                  <Text style={styles.nextHintText}>Siguiente: {hint}</Text>
                </View>
              )}
            </>
          )}
        </RailCard>

        {actions.canPromote && (
          <RailCard label="BORRADOR">
            <Text style={styles.mutedText}>
              Esta solicitud está incompleta. Complétala con el solicitante y promuévela a la cola
              de evaluación para poder revisarla.
            </Text>
            <BtnCta
              label="Promover a cola"
              icon={ArrowRight}
              color={colors.brand.blue.primary}
              disabled={busy}
              onPress={() => promote.mutate({ id })}
            />
          </RailCard>
        )}

        {(actions.canApprove || actions.canReject || actions.canClaim) && (
          <RailCard label="REVISIÓN">
            <TextInput
              style={styles.noteBox}
              value={note}
              onChangeText={setNote}
              placeholder="Agregar nota de revisión…"
              placeholderTextColor={colors.text.secondary}
              multiline
              numberOfLines={3}
              testID="review-note"
            />
            <Text style={styles.reviewHint}>El motivo es obligatorio al rechazar.</Text>
            {actions.canClaim && (
              <BtnOutline
                label="Tomar solicitud"
                icon={UserCheck}
                color={colors.brand.blue.primary}
                disabled={busy}
                onPress={() => claim.mutate({ id })}
              />
            )}
            {actions.canApprove && (
              <BtnCta
                label="Aprobar"
                icon={Check}
                color={colors.status.success}
                disabled={busy}
                onPress={() => approve.mutate({ id, note: note.trim() || undefined })}
              />
            )}
            {actions.canReject && (
              <BtnOutline
                label="Rechazar"
                disabled={busy}
                onPress={() => router.push(`/solicitud/${id}/rechazar`)}
              />
            )}
          </RailCard>
        )}

        {actions.canSign && (
          <RailCard label="CONTRATO">
            <Text style={styles.mutedText}>
              Genera el contrato PDF; luego sube el firmado para pasar a Firmada.
            </Text>
            <BtnCta
              label="Generar contrato"
              icon={FileDown}
              color={colors.brand.blue.deep}
              disabled={busy}
              onPress={() => router.push(`/solicitud/${id}/generar-contrato`)}
            />
            <BtnOutline
              label={capturing ? "Procesando…" : "Subir contrato firmado"}
              icon={Upload}
              color={colors.brand.blue.primary}
              disabled={busy}
              onPress={() => void handleUploadSignedContract()}
            />
          </RailCard>
        )}

        {(app.status === "SIGNED" || app.status === "CONVERTED") && app.contractFilename && (
          <ListTile
            icon={FileText}
            label="Ver contrato"
            onPress={() => void handleViewContract()}
          />
        )}

        {actions.canConvert && (
          <RailCard label="CONVERTIR EN CLIENTE">
            <Text style={styles.mutedText}>
              Registra los términos negociados y crea el préstamo del cliente.
            </Text>
            <BtnCta
              label="Convertir en cliente"
              icon={ArrowRight}
              color={colors.status.success}
              disabled={busy}
              onPress={() => router.push(`/solicitud/${id}/convertir`)}
            />
          </RailCard>
        )}

        {app.status === "CONVERTED" && (
          <RailCard label="RESULTADO">
            <View style={styles.resultBanner}>
              <CircleCheckBig size={18} color={colors.status.success} strokeWidth={2} />
              <Text style={styles.resultBannerText}>Préstamo creado correctamente.</Text>
            </View>
            {app.customerId && (
              <ListTile
                icon={User}
                label={`Cliente: ${name}`}
                onPress={() => router.push(`/cliente/${app.customerId}`)}
              />
            )}
            {app.loanId != null && (
              <ListTile
                icon={FileText}
                label={`Préstamo #${app.loanId}`}
                onPress={() => router.push(`/prestamo/${app.loanId}`)}
              />
            )}
          </RailCard>
        )}

        <ListTile
          icon={FileText}
          label="Ver datos de la solicitud"
          onPress={() => router.push(`/solicitud/${id}/datos`)}
        />

        {actions.canReopen && (
          <Pressable
            style={styles.discard}
            onPress={() => reopen.mutate({ id })}
            disabled={busy}
            testID="reopen-solicitud"
          >
            <RotateCcw size={15} color={colors.text.secondary} strokeWidth={2} />
            <Text style={styles.discardText}>{reopenActionLabel(app.status)}</Text>
          </Pressable>
        )}

        {app.status !== "CONVERTED" && (
          <Pressable
            style={styles.discard}
            onPress={() => router.push(`/solicitud/${id}/descartar`)}
            testID="discard-solicitud"
          >
            <Trash2 size={15} color={colors.text.secondary} strokeWidth={2} />
            <Text style={styles.discardText}>Descartar solicitud</Text>
          </Pressable>
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
  mutedText: { fontFamily: "Geist_500Medium", fontSize: 13, color: colors.text.secondary },
  terminalText: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.status.danger },
  breakdownToggle: { flexDirection: "row", alignItems: "center", gap: 7 },
  breakdownToggleText: {
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: colors.brand.blue.primary
  },
  breakdownList: { gap: 12, paddingTop: 4 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepText: { fontFamily: "Geist_500Medium", fontSize: 13, color: colors.text.secondary },
  stepTextActive: { color: colors.brand.ink },
  nextHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#EEF3F9",
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  nextHintText: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.brand.ink },
  noteBox: {
    width: "100%",
    minHeight: 70,
    borderRadius: 8,
    backgroundColor: "#F4F7FB",
    borderWidth: 1,
    borderColor: colors.border.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: colors.brand.ink,
    textAlignVertical: "top"
  },
  reviewHint: { fontFamily: "Geist_500Medium", fontSize: 11, color: colors.text.secondary },
  resultBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    backgroundColor: colors.status.successBg,
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  resultBannerText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13,
    color: colors.status.success
  },
  discard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4
  },
  discardText: { fontFamily: "Geist_500Medium", fontSize: 13, color: colors.text.secondary }
});
