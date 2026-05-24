/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Printer } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { PaymentRow } from "../../components/ui/PaymentRow";
import { SectionLabel } from "../../components/ui/SectionLabel";

const PAYMENTS = [
  {
    day: "4",
    month: "MAY",
    title: "Cuota 3 · RD$2,400",
    subtitle: "Pago completo · Efectivo · Recibo #R-00872",
    amount: "RD$2,400",
    note: "sin mora"
  },
  {
    day: "27",
    month: "ABR",
    title: "Cuota 2 · RD$2,400",
    subtitle: "Pago completo · Efectivo · Recibo #R-00854",
    amount: "RD$2,400",
    note: "sin mora"
  },
  {
    day: "22",
    month: "ABR",
    title: "Abono a cuenta",
    subtitle: "Anticipo del cliente · Aplicado a cuota 2",
    amount: "RD$500",
    note: "sin mora"
  },
  {
    day: "20",
    month: "ABR",
    title: "Cuota 1 · RD$2,400",
    subtitle: "Pago completo · Efectivo · Recibo #R-00831",
    amount: "RD$2,400",
    note: "sin mora"
  }
];

export default function HistoricoPagosScreen() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();

  return (
    <View style={styles.screen}>
      <Header
        title="Histórico de pagos"
        subtitle={`José Núñez · Préstamo #${loanId}`}
        rightIcon={Printer}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL COBRADO</Text>
          <View style={styles.summaryAmountRow}>
            <Text style={styles.summaryCurrency}>RD$</Text>
            <Text style={styles.summaryAmount}>7,200</Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryGridItem}>
              <Text style={styles.gridLabel}>Cuotas pagadas</Text>
              <Text style={styles.gridValue}>3 de 12</Text>
            </View>
            <View style={styles.summaryGridItem}>
              <Text style={styles.gridLabel}>Mora pagada</Text>
              <Text style={styles.gridValue}>RD$0</Text>
            </View>
            <View style={styles.summaryGridItem}>
              <Text style={styles.gridLabel}>Último pago</Text>
              <Text style={styles.gridValue}>4 may</Text>
            </View>
          </View>
        </View>

        <SectionLabel>PAGOS REGISTRADOS</SectionLabel>

        {PAYMENTS.map((p, i) => (
          <PaymentRow key={i} {...p} />
        ))}

        <View style={styles.printHint}>
          <Text style={styles.printIcon}>⎙</Text>
          <Text style={styles.printText}>Imprime el historial completo para el cliente.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  summaryCard: {
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  summaryLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
    letterSpacing: 1.4,
    color: "#A9C4F2"
  },
  summaryAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  summaryCurrency: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 18,
    color: colors.brand.yellow.accent
  },
  summaryAmount: {
    fontFamily: "Geist_700Bold",
    fontSize: 36,
    color: colors.brand.white,
    letterSpacing: -1
  },
  summaryGrid: { flexDirection: "row", gap: 10 },
  summaryGridItem: { flex: 1, gap: 2 },
  gridLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.6,
    color: "#A9C4F2"
  },
  gridValue: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.white },
  printHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brand.mist,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  printIcon: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.blue.deep },
  printText: {
    flex: 1,
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    color: colors.brand.blue.deep,
    lineHeight: 15
  }
});
