/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04b Rechazar - Motivo` (qDNPG): a required preset reason
 * (mirrors the detail screen's "El motivo es obligatorio al rechazar" copy)
 * plus an optional free-text comment. `rejectApplicationSchema` only accepts a
 * single `reason` string, so the submitted reason combines the selected
 * preset with the optional comment (task 6.1).
 */
import { useState } from "react";
import { Alert, View, Text, ScrollView, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MessageSquare, X } from "lucide-react-native";
import { colors, radii } from "../../../lib/theme";
import { trpc } from "../../../lib/api";
import { Header } from "../../../components/ui/Header";
import { SectionLabel } from "../../../components/ui/SectionLabel";
import { OptionRow } from "../../../components/ui/OptionRow";
import { BtnCta } from "../../../components/ui/BtnCta";
import { applicantName } from "../../../lib/applications";

const REASONS = [
  "Capacidad de pago insuficiente",
  "Referencias no verificables",
  "Documentación incompleta",
  "Negocio de alto riesgo",
  "Otro motivo"
];

export default function RechazarSolicitudScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const q = trpc.getApplication.useQuery({ id });
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const reject = trpc.rejectApplication.useMutation({
    onSuccess: () => {
      void utils.getApplication.invalidate({ id });
      void utils.listApplications.invalidate();
      router.back();
    },
    onError: (err) => Alert.alert("Error", `No se pudo rechazar la solicitud. ${err.message}`)
  });

  const app = q.data;
  const name = app ? applicantName(app) : "";

  function handleConfirm() {
    if (!reason) return;
    const trimmed = comment.trim();
    reject.mutate({ id, reason: trimmed ? `${reason} — ${trimmed}` : reason });
  }

  return (
    <View style={styles.screen}>
      <Header title="Rechazar solicitud" subtitle={name} backMode="close" />
      <ScrollView contentContainerStyle={styles.body}>
        <SectionLabel>MOTIVO DEL RECHAZO</SectionLabel>
        <View style={styles.reasonList}>
          {REASONS.map((r) => (
            <OptionRow key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
          ))}
        </View>

        <SectionLabel>COMENTARIO ADICIONAL (OPCIONAL)</SectionLabel>
        <View style={styles.commentBox}>
          <MessageSquare size={18} color={colors.text.secondary} strokeWidth={2} />
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Añade contexto para el equipo…"
            placeholderTextColor={colors.text.secondary}
            multiline
            testID="reject-comment"
          />
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <BtnCta
          label={reject.isPending ? "Rechazando…" : "Confirmar rechazo"}
          icon={X}
          color={colors.status.danger}
          disabled={!reason || reject.isPending}
          onPress={handleConfirm}
        />
        <Pressable onPress={() => router.back()} disabled={reject.isPending}>
          <Text style={styles.cancel}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 10 },
  reasonList: { gap: 10 },
  commentBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.brand.white,
    borderRadius: radii.sm + 4,
    borderWidth: 1,
    borderColor: "#D3DFF4",
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.brand.ink,
    padding: 0
  },
  actionBar: {
    gap: 10,
    padding: 20,
    backgroundColor: colors.brand.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light
  },
  cancel: {
    textAlign: "center",
    fontFamily: "Geist_600SemiBold",
    fontSize: 14,
    color: colors.text.secondary
  }
});
