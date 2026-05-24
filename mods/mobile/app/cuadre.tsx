/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { colors } from "../lib/theme";
import { Header } from "../components/ui/Header";
import { KvRow } from "../components/ui/KvRow";

export default function CuadreScreen() {
  return (
    <View style={styles.screen}>
      <Header title="Cuadre del día" subtitle="Lunes, 11 mayo · Carlos R." />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>EFECTIVO ESPERADO</Text>
          <View style={styles.summaryAmountRow}>
            <Text style={styles.summaryCurrency}>RD$</Text>
            <Text style={styles.summaryAmount}>18,250</Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryGridItem}>
              <Text style={styles.gridLabel}>Recibos</Text>
              <Text style={styles.gridValue}>20</Text>
            </View>
            <View style={styles.summaryGridItem}>
              <Text style={styles.gridLabel}>Visitas</Text>
              <Text style={styles.gridValue}>23</Text>
            </View>
            <View style={styles.summaryGridItem}>
              <Text style={styles.gridLabel}>Promesas</Text>
              <Text style={styles.gridValue}>2</Text>
            </View>
          </View>
        </View>

        <View style={styles.countCard}>
          <Text style={styles.countLabel}>EFECTIVO CONTADO</Text>
          <View style={styles.countInputRow}>
            <Text style={styles.countCurrency}>RD$</Text>
            <Text style={styles.countAmount}>18,250</Text>
            <View style={styles.matchPill}>
              <Text style={styles.matchCheck}>✓</Text>
              <Text style={styles.matchText}>Coincide</Text>
            </View>
          </View>
          <Text style={styles.countHint}>
            Conta el efectivo y escribe el total. El sistema te avisa si hay diferencia.
          </Text>
        </View>

        <View style={styles.breakdownCard}>
          <View style={styles.breakdownHeader}>
            <KvRow label="DESGLOSE" value="Ver 20 recibos ›" />
          </View>
          <KvRow label="Cuotas" value="RD$15,200" />
          <KvRow label="Atrasos" value="RD$2,400" />
          <KvRow label="Cargos por mora" value="RD$300" />
          <KvRow label="Abonos a cuenta" value="RD$350" />
        </View>

        <View style={styles.notesCard}>
          <Text style={styles.notesLabel}>OBSERVACIONES</Text>
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>
              2 clientes en zona alta · Felipe Taveras no contestó.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.closeBtn}>
          <Text style={styles.closeBtnCheck}>✓</Text>
          <Text style={styles.closeBtnText}>Cerrar día y sincronizar</Text>
        </Pressable>
        <Text style={styles.footerHint}>
          Al cerrar, se envían todos los cobros y se bloquea la edición.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  content: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  summaryCard: {
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 18,
    padding: 18,
    gap: 12
  },
  summaryLabel: { fontFamily: "Geist_700Bold", fontSize: 10, letterSpacing: 1.4, color: "#A9C4F2" },
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
  summaryGrid: { flexDirection: "row", gap: 8 },
  summaryGridItem: { flex: 1, gap: 2 },
  gridLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.6,
    color: "#A9C4F2"
  },
  gridValue: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.white },
  countCard: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 18,
    gap: 10
  },
  countLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.secondary
  },
  countInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg.screen,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#D3DFF4"
  },
  countCurrency: { fontFamily: "Geist_600SemiBold", fontSize: 18, color: colors.text.secondary },
  countAmount: {
    fontFamily: "Geist_700Bold",
    fontSize: 28,
    color: colors.brand.ink,
    letterSpacing: -0.5
  },
  matchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginLeft: "auto"
  },
  matchCheck: { fontFamily: "Geist_700Bold", fontSize: 11, color: "#15803D" },
  matchText: { fontFamily: "Geist_700Bold", fontSize: 11, color: "#15803D" },
  countHint: {
    fontFamily: "Geist_500Medium",
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 16
  },
  breakdownCard: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  breakdownHeader: { marginBottom: 4 },
  notesCard: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 16,
    gap: 8
  },
  notesLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.secondary
  },
  notesBox: {
    backgroundColor: colors.bg.screen,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D3DFF4"
  },
  notesText: {
    fontFamily: "Geist_500Medium",
    fontSize: 12,
    color: colors.brand.ink,
    lineHeight: 17
  },
  footer: {
    backgroundColor: colors.brand.white,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.light
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18
  },
  closeBtnCheck: { fontFamily: "Geist_700Bold", fontSize: 16, color: colors.brand.yellow.accent },
  closeBtnText: { fontFamily: "Geist_700Bold", fontSize: 15, color: colors.brand.white },
  footerHint: {
    fontFamily: "Geist_500Medium",
    fontSize: 11,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 15
  }
});
