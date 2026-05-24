/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, Clock3, Check } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { ClientRow } from "../../components/ui/ClientRow";
import { SectionLabel } from "../../components/ui/SectionLabel";

const OUTCOMES = [
  { key: "promise", label: "Promesa de pago" },
  { key: "nocontact", label: "Sin contacto" },
  { key: "refused", label: "No quiere pagar" },
  { key: "reschedule", label: "Reagendar" }
];

export default function AnotarVisitaScreen() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [outcome, setOutcome] = useState("promise");
  const [comment, setComment] = useState(
    "Cliente confirmó pago para mañana, acordamos visita en su negocio…"
  );

  return (
    <View style={styles.screen}>
      <Header title="Anotar visita" backMode="close" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ClientRow name="José Núñez · Cuota 4" business="" meta="11 may · 10:14 AM" amount="" />

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

        <SectionLabel>PROMESA DE PAGO</SectionLabel>
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Calendar size={18} color={colors.brand.blue.primary} strokeWidth={2} />
            <Text style={styles.dateText}>Mañana, 12 may</Text>
          </View>
          <View style={styles.dateField}>
            <Clock3 size={18} color={colors.brand.blue.primary} strokeWidth={2} />
            <Text style={styles.dateText}>3:00 PM</Text>
          </View>
        </View>

        <SectionLabel>MONTO PROMETIDO</SectionLabel>
        <View style={styles.amountField}>
          <Text style={styles.amountCurrency}>RD$</Text>
          <Text style={styles.amountValue}>3,150</Text>
        </View>

        <SectionLabel>COMENTARIO</SectionLabel>
        <View style={styles.commentBox}>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            multiline
            placeholder="Agrega un comentario…"
            placeholderTextColor={colors.text.secondary}
          />
          <View style={styles.commentFooter}>
            <View style={styles.voicePill}>
              <Text style={styles.voicePillText}>Nota de voz</Text>
            </View>
            <Text style={styles.charCount}>{comment.length}/280</Text>
          </View>
        </View>
      </ScrollView>

      <Pressable style={styles.ctaBtn} onPress={() => router.back()}>
        <Check size={20} color={colors.brand.white} strokeWidth={2} />
        <Text style={styles.ctaText}>Guardar visita</Text>
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
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  dateText: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.ink },
  amountField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  amountCurrency: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 14,
    color: colors.brand.blue.primary
  },
  amountValue: { fontFamily: "Geist_700Bold", fontSize: 18, color: colors.brand.ink },
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
  commentFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  voicePill: {
    backgroundColor: colors.brand.mist,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  voicePillText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    color: colors.brand.blue.primary
  },
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
