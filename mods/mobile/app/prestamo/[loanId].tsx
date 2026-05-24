/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Banknote, NotebookPen, EllipsisVertical } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { CuotaRow } from "../../components/ui/CuotaRow";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { KvRow } from "../../components/ui/KvRow";

const CUOTAS = [
  { name: "Cuota 1", date: "20 abr", amount: "RD$2,400", status: "paid" as const },
  { name: "Cuota 2", date: "27 abr", amount: "RD$2,400", status: "paid" as const },
  { name: "Cuota 3", date: "4 may", amount: "RD$2,400", status: "paid" as const },
  { name: "Cuota 4", date: "11 may · ATRASO", amount: "RD$3,150", status: "overdue" as const },
  { name: "Cuota 5", date: "18 may", amount: "RD$2,400", status: "pending" as const }
];

export default function PrestamoDetalleScreen() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Header
        title={`Préstamo #${loanId}`}
        subtitle="José Núñez · Motoconcho"
        rightIcon={EllipsisVertical}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.metaPills}>
          {["Diario", "46 días", "Vence 5 jun"].map((t) => (
            <View key={t} style={styles.metaPill}>
              <Text style={styles.metaPillText}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>BALANCE PENDIENTE</Text>
          <Text style={styles.summaryNumber}>RD$18,000</Text>
          <ProgressBar progress={3 / 12} color={colors.brand.white} />
          <View style={styles.summaryGrid}>
            <View>
              <Text style={styles.gridLabel}>Pagado</Text>
              <Text style={styles.gridValue}>RD$7,200</Text>
            </View>
            <View>
              <Text style={styles.gridLabel}>Cuota</Text>
              <Text style={styles.gridValue}>3 / 12</Text>
            </View>
            <View>
              <Text style={styles.gridLabel}>Próxima</Text>
              <Text style={styles.gridValue}>11 may</Text>
            </View>
          </View>
        </View>

        <View style={styles.totalCard}>
          <View style={styles.totalHeader}>
            <View style={{ gap: 2 }}>
              <Text style={styles.totalLabel}>TOTAL A PAGAR HOY</Text>
              <Text style={styles.totalSub}>Lo que el cliente debe entregar ahora</Text>
            </View>
            <View style={styles.totalAmountRow}>
              <Text style={styles.totalCurrency}>RD$</Text>
              <Text style={styles.totalAmount}>3,150</Text>
            </View>
          </View>
          <View style={styles.totalDivider} />
          <KvRow label="Cuota pendiente" value="RD$2,400" />
          <KvRow label="Cargo por mora" value="RD$750" />
        </View>

        <View style={styles.planHeader}>
          <SectionLabel>PLAN DE PAGOS</SectionLabel>
          <Pressable onPress={() => router.push(`/historico/${loanId}`)}>
            <Text style={styles.planLink}>Ver historial ›</Text>
          </Pressable>
        </View>

        <View style={styles.cuotaList}>
          {CUOTAS.map((c) => (
            <CuotaRow key={c.name} {...c} />
          ))}
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <Pressable style={styles.ctaSecondary} onPress={() => router.push(`/visita/${loanId}`)}>
          <NotebookPen size={16} color={colors.brand.blue.deep} strokeWidth={2} />
          <Text style={styles.ctaSecondaryText}>Anotar visita</Text>
        </Pressable>
        <Pressable style={styles.ctaPrimary} onPress={() => router.push(`/cobrar/${loanId}`)}>
          <Banknote size={16} color={colors.brand.white} strokeWidth={2} />
          <Text style={styles.ctaPrimaryText}>Cobrar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  metaPills: { flexDirection: "row", gap: 6 },
  metaPill: {
    backgroundColor: colors.brand.mist,
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  metaPillText: { fontFamily: "Geist_700Bold", fontSize: 11, color: colors.brand.blue.deep },
  summaryCard: {
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 18,
    padding: 20,
    gap: 14
  },
  summaryLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#9DB9F0"
  },
  summaryNumber: {
    fontFamily: "Geist_700Bold",
    fontSize: 36,
    color: colors.brand.white,
    letterSpacing: -1
  },
  summaryGrid: { flexDirection: "row", justifyContent: "space-between" },
  gridLabel: { fontFamily: "Geist_500Medium", fontSize: 11, color: "#9DB9F0" },
  gridValue: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.white },
  totalCard: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 16,
    gap: 12
  },
  totalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.secondary
  },
  totalSub: { fontFamily: "Geist_500Medium", fontSize: 11, color: colors.text.secondary },
  totalAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  totalCurrency: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.orange.deep },
  totalAmount: {
    fontFamily: "Geist_700Bold",
    fontSize: 26,
    color: colors.brand.orange.deep,
    letterSpacing: -0.5
  },
  totalDivider: { height: 1, backgroundColor: colors.border.light },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  planLink: { fontFamily: "Geist_700Bold", fontSize: 11, color: colors.brand.blue.deep },
  cuotaList: { gap: 6 },
  ctaBar: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.brand.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light
  },
  ctaSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brand.mist,
    borderRadius: 12,
    padding: 14
  },
  ctaSecondaryText: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.blue.deep },
  ctaPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 12,
    padding: 14
  },
  ctaPrimaryText: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.white }
});
