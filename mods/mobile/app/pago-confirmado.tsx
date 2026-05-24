/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Check, Printer, MessageCircle } from "lucide-react-native";
import { colors } from "../lib/theme";
import { KvRow } from "../components/ui/KvRow";

export default function PagoConfirmadoScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.iconCircle}>
          <Check size={48} color={colors.brand.blue.deep} strokeWidth={2} />
        </View>

        <View style={styles.headline}>
          <Text style={styles.h1}>¡Pago registrado!</Text>
          <Text style={styles.h2}>Cobro confirmado a José Núñez</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardAmountSection}>
            <Text style={styles.cardLabel}>TOTAL COBRADO</Text>
            <Text style={styles.cardAmount}>RD$3,150</Text>
          </View>
          <View style={styles.cardDivider} />
          <KvRow label="Mora aplicada" value="RD$750" />
          <KvRow label="Cuota 4" value="RD$2,400" />
          <KvRow label="Método" value="Efectivo" />
          <KvRow label="Recibo" value="#R-00891" />
          <KvRow label="Hora" value="11 may, 9:41 AM" />
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn}>
            <Printer size={18} color={colors.brand.white} strokeWidth={2} />
            <Text style={styles.actionBtnText}>Imprimir</Text>
          </Pressable>
          <Pressable style={styles.actionBtn}>
            <MessageCircle size={18} color={colors.brand.white} strokeWidth={2} />
            <Text style={styles.actionBtnText}>WhatsApp</Text>
          </Pressable>
        </View>
        <Pressable style={styles.doneBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.doneBtnText}>Listo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand.blue.deep },
  body: { alignItems: "center", paddingHorizontal: 32, paddingTop: 80, gap: 24, flex: 1 },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brand.yellow.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  headline: { alignItems: "center", gap: 6, width: "100%" },
  h1: { fontFamily: "Geist_700Bold", fontSize: 28, color: colors.brand.white, letterSpacing: -0.5 },
  h2: { fontFamily: "Geist_500Medium", fontSize: 14, color: "#9DB9F0" },
  card: {
    backgroundColor: colors.brand.white,
    borderRadius: 20,
    padding: 24,
    gap: 14,
    width: "100%"
  },
  cardAmountSection: { gap: 4 },
  cardLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.text.secondary
  },
  cardAmount: {
    fontFamily: "Geist_700Bold",
    fontSize: 40,
    color: colors.brand.blue.deep,
    letterSpacing: -1
  },
  cardDivider: { height: 1, backgroundColor: colors.brand.mist },
  actions: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28, gap: 10 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.blue.primary,
    borderRadius: 12,
    padding: 14
  },
  actionBtnText: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.white },
  doneBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 14
  },
  doneBtnText: { fontFamily: "Geist_700Bold", fontSize: 15, color: colors.brand.blue.deep }
});
