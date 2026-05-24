/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Banknote, ArrowRightLeft, Check } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { ClientRow } from "../../components/ui/ClientRow";
import { OptionRow } from "../../components/ui/OptionRow";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { KvRow } from "../../components/ui/KvRow";

const PAY_OPTIONS = [
  { key: "arrears", label: "Cobrar atrasos", value: "RD$3,150" },
  { key: "multi", label: "Cobrar cuotas multiples", value: "RD$2,400 × N" },
  { key: "custom", label: "Monto personalizado", value: "Escribir" },
  { key: "settle", label: "Saldar préstamo", value: "RD$18,750" }
];

export default function CobrarPagoScreen() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState("arrears");
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");

  return (
    <View style={styles.screen}>
      <Header title="Registrar cobro" backMode="close" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ClientRow name="José Núñez" business="" meta="Motoconcho · Préstamo #L-00234" amount="" />

        <View style={styles.amountCard}>
          <SectionLabel>MONTO A COBRAR</SectionLabel>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>RD$</Text>
            <Text style={styles.amountNumber}>3,150</Text>
          </View>
          <Text style={styles.amountHint}>Cobrar atrasos seleccionado</Text>
        </View>

        <View style={styles.optionsSection}>
          <SectionLabel>TIPO DE COBRO</SectionLabel>
          {PAY_OPTIONS.map((o) => (
            <OptionRow
              key={o.key}
              label={o.label}
              value={o.value}
              selected={selectedOption === o.key}
              onPress={() => setSelectedOption(o.key)}
            />
          ))}
        </View>

        <View style={styles.breakdownCard}>
          <SectionLabel>CÓMO SE APLICA</SectionLabel>
          <KvRow label="Mora (prioridad)" value="RD$750" />
          <KvRow label="Cuota 4" value="RD$2,400" />
        </View>

        <View style={styles.methodSection}>
          <SectionLabel>MÉTODO DE PAGO</SectionLabel>
          <View style={styles.methodRow}>
            <Pressable
              style={[styles.methodBtn, payMethod === "cash" && styles.methodBtnActive]}
              onPress={() => setPayMethod("cash")}
            >
              <Banknote
                size={18}
                color={payMethod === "cash" ? colors.brand.white : colors.brand.blue.deep}
                strokeWidth={2}
              />
              <Text style={[styles.methodText, payMethod === "cash" && styles.methodTextActive]}>
                Efectivo
              </Text>
            </Pressable>
            <Pressable
              style={[styles.methodBtn, payMethod === "transfer" && styles.methodBtnActive]}
              onPress={() => setPayMethod("transfer")}
            >
              <ArrowRightLeft
                size={18}
                color={payMethod === "transfer" ? colors.brand.white : colors.brand.blue.deep}
                strokeWidth={2}
              />
              <Text
                style={[styles.methodText, payMethod === "transfer" && styles.methodTextActive]}
              >
                Transferencia
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Pressable style={styles.ctaBtn} onPress={() => router.replace("/pago-confirmado")}>
        <Check size={20} color={colors.brand.white} strokeWidth={2} />
        <Text style={styles.ctaText}>Confirmar y cobrar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 18 },
  amountCard: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 20,
    paddingVertical: 24,
    alignItems: "center",
    gap: 8
  },
  amountRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  amountCurrency: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 22,
    color: colors.brand.blue.primary
  },
  amountNumber: {
    fontFamily: "Geist_700Bold",
    fontSize: 54,
    color: colors.brand.blue.deep,
    letterSpacing: -2,
    lineHeight: 54
  },
  amountHint: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.orange.deep },
  optionsSection: { gap: 8 },
  breakdownCard: {
    backgroundColor: colors.brand.white,
    borderRadius: radii.card,
    padding: 14,
    gap: 10
  },
  methodSection: { gap: 8 },
  methodRow: { flexDirection: "row", gap: 8 },
  methodBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D3DFF4"
  },
  methodBtnActive: { backgroundColor: colors.brand.blue.deep, borderColor: colors.brand.blue.deep },
  methodText: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.blue.deep },
  methodTextActive: { color: colors.brand.white },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.brand.blue.deep,
    padding: 18,
    marginHorizontal: 0
  },
  ctaText: { fontFamily: "Geist_700Bold", fontSize: 15, color: colors.brand.white }
});
