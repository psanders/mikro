/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, MessageCircle } from "lucide-react-native";
import { colors } from "../lib/theme";
import { KvRow } from "../components/ui/KvRow";

function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO")}`;
}

function formatNow(): string {
  const now = new Date();
  const day = now.getDate();
  const months = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic"
  ];
  const month = months[now.getMonth()];
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${day} ${month}, ${h % 12 || 12}:${m} ${ampm}`;
}

export default function PagoConfirmadoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    customerName?: string;
    amount?: string;
    mora?: string;
    cuota?: string;
    method?: string;
    loanId?: string;
  }>();

  const amount = Number(params.amount) || 0;
  const mora = Number(params.mora) || 0;
  const cuota = Number(params.cuota) || 0;
  const customerName = params.customerName ?? "Cliente";
  const method = params.method ?? "Efectivo";
  const loanId = params.loanId ?? "";

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.iconCircle}>
          <Check size={48} color={colors.brand.blue.deep} strokeWidth={2} />
        </View>

        <View style={styles.headline}>
          <Text style={styles.h1}>¡Pago registrado!</Text>
          <Text style={styles.h2}>Cobro confirmado a {customerName}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardAmountSection}>
            <Text style={styles.cardLabel}>TOTAL COBRADO</Text>
            <Text style={styles.cardAmount}>{formatRD(amount)}</Text>
          </View>
          <View style={styles.cardDivider} />
          {mora > 0 && <KvRow label="Mora aplicada" value={formatRD(mora)} />}
          {cuota > 0 && <KvRow label="Cuota" value={formatRD(cuota)} />}
          <KvRow label="Método" value={method} />
          {loanId ? <KvRow label="Préstamo" value={`#${loanId}`} /> : null}
          <KvRow label="Hora" value={formatNow()} />
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => {
            Linking.openURL("https://wa.me/").catch(() => {});
          }}
        >
          <MessageCircle size={18} color={colors.brand.white} strokeWidth={2} />
          <Text style={styles.actionBtnText}>Enviar recibo</Text>
        </Pressable>
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
  actionBtn: {
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
