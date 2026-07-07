/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { ClientRow } from "../../components/ui/ClientRow";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { trpc } from "../../lib/api";
import { useLocalLoan, useLocalLoanVisit, useLocalCollector } from "../../lib/offline/hooks";
import { useSyncContext } from "../../lib/offline/SyncProvider";
import { queueLoanNote } from "../../lib/offline/mutations";

const OUTCOMES = [
  { key: "promise", label: "Promesa de pago" },
  { key: "nocontact", label: "Sin contacto" },
  { key: "refused", label: "No quiere pagar" },
  { key: "reschedule", label: "Reagendar" }
] as const;

type OutcomeKey = (typeof OUTCOMES)[number]["key"];

const OUTCOME_LABELS: Record<OutcomeKey, string> = {
  promise: "Promesa de pago",
  nocontact: "Sin contacto",
  refused: "No quiere pagar",
  reschedule: "Reagendar"
};

export default function AnotarVisitaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const router = useRouter();
  const [outcome, setOutcome] = useState<OutcomeKey>("promise");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const visitQuery = useLocalLoanVisit(numericId);
  const loanQuery = useLocalLoan(numericId);
  const collectorQuery = useLocalCollector();
  const { isOnline, refreshState } = useSyncContext();

  const createNote = trpc.createLoanNote.useMutation();

  const visit = visitQuery.data;

  const collectorId = collectorQuery.data?.id;

  const displayName =
    loanQuery.data?.customer?.nickname ??
    loanQuery.data?.customer?.name ??
    visit?.loanNickname ??
    visit?.customerName ??
    "...";

  const cuotaInfo = visit ? `${visit.installmentNumber - 1} de ${visit.termLength} pagadas` : "";

  const now = new Date();
  const timeStr = `${now.getDate()} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][now.getMonth()]} · ${now.getHours() % 12 || 12}:${now.getMinutes().toString().padStart(2, "0")} ${now.getHours() >= 12 ? "PM" : "AM"}`;

  const handleSave = async () => {
    if (!collectorId || submitting) return;

    const trimmed = comment.trim();
    const noteContent = trimmed
      ? `[${OUTCOME_LABELS[outcome]}] ${trimmed}`
      : `[${OUTCOME_LABELS[outcome]}]`;

    setSubmitting(true);
    try {
      if (isOnline) {
        await createNote.mutateAsync({
          loanId: numericId,
          content: noteContent,
          createdById: collectorId
        });
      } else {
        queueLoanNote({
          loanId: numericId,
          content: noteContent,
          createdById: collectorId
        });
      }
      refreshState();
      router.back();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      Alert.alert("Error", `No se pudo guardar la visita: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Header title="Anotar visita" backMode="close" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ClientRow name={`${displayName} · ${cuotaInfo}`} business="" meta={timeStr} amount="" />

        <SectionLabel>RESULTADO DE LA VISITA</SectionLabel>
        <View style={styles.outcomeGrid}>
          <View style={styles.outcomeRow}>
            {OUTCOMES.slice(0, 2).map((o) => (
              <Pressable
                key={o.key}
                style={[styles.outcomeBtn, outcome === o.key && styles.outcomeBtnActive]}
                onPress={() => setOutcome(o.key)}
              >
                <View
                  style={[styles.outcomeRadio, outcome === o.key && styles.outcomeRadioActive]}
                />
                <Text style={[styles.outcomeText, outcome === o.key && styles.outcomeTextActive]}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.outcomeRow}>
            {OUTCOMES.slice(2).map((o) => (
              <Pressable
                key={o.key}
                style={[styles.outcomeBtn, outcome === o.key && styles.outcomeBtnActive]}
                onPress={() => setOutcome(o.key)}
              >
                <View
                  style={[styles.outcomeRadio, outcome === o.key && styles.outcomeRadioActive]}
                />
                <Text style={[styles.outcomeText, outcome === o.key && styles.outcomeTextActive]}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <SectionLabel>COMENTARIO</SectionLabel>
        <View style={styles.commentBox}>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={(t) => setComment(t.slice(0, 280))}
            multiline
            placeholder="Agrega un comentario…"
            placeholderTextColor={colors.text.secondary}
          />
          <View style={styles.commentFooter}>
            <Text style={styles.charCount}>{comment.length}/280</Text>
          </View>
        </View>
      </ScrollView>

      <Pressable
        style={[styles.ctaBtn, submitting && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.brand.white} />
        ) : (
          <Check size={20} color={colors.brand.white} strokeWidth={2} />
        )}
        <Text style={styles.ctaText}>{submitting ? "Guardando..." : "Guardar visita"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 18 },
  outcomeGrid: { gap: 8 },
  outcomeRow: { flexDirection: "row", gap: 8 },
  outcomeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D3DFF4"
  },
  outcomeBtnActive: {
    backgroundColor: colors.brand.blue.deep,
    borderColor: colors.brand.blue.deep
  },
  outcomeRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.text.secondary
  },
  outcomeRadioActive: { borderColor: colors.brand.mist, backgroundColor: colors.brand.white },
  outcomeText: { fontFamily: "Geist_500Medium", fontSize: 13, color: colors.brand.ink },
  outcomeTextActive: { fontFamily: "Geist_600SemiBold", color: colors.brand.white },
  commentBox: {
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 14,
    gap: 10
  },
  commentInput: {
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: colors.brand.ink,
    lineHeight: 19,
    minHeight: 60
  },
  commentFooter: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  charCount: { fontFamily: "Geist_500Medium", fontSize: 11, color: colors.text.secondary },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.brand.blue.deep,
    padding: 18
  },
  ctaText: { fontFamily: "Geist_700Bold", fontSize: 15, color: colors.brand.white }
});
