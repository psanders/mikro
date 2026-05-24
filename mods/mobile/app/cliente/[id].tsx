/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Phone,
  MapPin,
  IdCard,
  MessageCircle,
  Map,
  ChevronRight,
  Check
} from "lucide-react-native";
import { colors, radii } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { Avatar } from "../../components/ui/Avatar";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { SectionLabel } from "../../components/ui/SectionLabel";

export default function ClienteDetalleScreen() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Header title="Cliente" rightIcon={Phone} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <Avatar name="María Rosa Peralta" size={72} />
          <Text style={styles.profileName}>María Rosa Peralta</Text>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: colors.brand.blue.primary }]} />
            <Text style={styles.statusText}>Al día · Cliente desde 2024</Text>
          </View>

          <View style={styles.infoRows}>
            <View style={styles.infoRow}>
              <Phone size={16} color={colors.brand.blue.primary} strokeWidth={2} />
              <Text style={styles.infoText}>829-555-0143</Text>
            </View>
            <View style={styles.infoRow}>
              <MapPin size={16} color={colors.brand.blue.primary} strokeWidth={2} />
              <Text style={styles.infoText}>Calle Duarte 24, Santo Domingo</Text>
            </View>
            <View style={styles.infoRow}>
              <IdCard size={16} color={colors.brand.blue.primary} strokeWidth={2} />
              <Text style={styles.infoText}>Cédula 001-1234567-8</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.actionBtn}>
              <Phone size={16} color={colors.brand.blue.deep} strokeWidth={2} />
              <Text style={styles.actionBtnText}>Llamar</Text>
            </Pressable>
            <Pressable style={styles.actionBtn}>
              <MessageCircle size={16} color={colors.brand.blue.deep} strokeWidth={2} />
              <Text style={styles.actionBtnText}>WhatsApp</Text>
            </Pressable>
            <Pressable style={styles.actionBtn}>
              <Map size={16} color={colors.brand.blue.deep} strokeWidth={2} />
              <Text style={styles.actionBtnText}>Mapa</Text>
            </Pressable>
          </View>
        </View>

        <SectionLabel>PRÉSTAMOS ACTIVOS</SectionLabel>

        <Pressable style={styles.loanCard} onPress={() => router.push("/prestamo/L-00234")}>
          <View style={styles.loanHeader}>
            <View style={styles.loanHeaderLeft}>
              <Text style={styles.loanTitle}>Préstamo #L-00234</Text>
              <Text style={styles.loanSub}>RD$28,800 · Pago semanal</Text>
            </View>
            <ChevronRight size={18} color={colors.text.secondary} strokeWidth={2} />
          </View>
          <ProgressBar progress={4 / 12} />
          <View style={styles.loanMeta}>
            <Text style={styles.loanMetaLeft}>Cuota 4 de 12</Text>
            <Text style={styles.loanMetaRight}>Próxima hoy · RD$2,400</Text>
          </View>
        </Pressable>

        <SectionLabel>VISITAS RECIENTES</SectionLabel>

        <View style={styles.visitList}>
          {[
            { title: "Pago cuota 3 · RD$2,400", date: "4 mayo · 10:22 AM" },
            { title: "Pago cuota 2 · RD$2,400", date: "27 abr · 11:08 AM" }
          ].map((v, i) => (
            <View key={i} style={styles.visitRow}>
              <View style={styles.visitDot}>
                <Check size={14} color={colors.brand.blue.primary} strokeWidth={2} />
              </View>
              <View style={styles.visitTextWrap}>
                <Text style={styles.visitTitle}>{v.title}</Text>
                <Text style={styles.visitDate}>{v.date}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  profileCard: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    gap: 14
  },
  profileName: { fontFamily: "Geist_700Bold", fontSize: 20, color: colors.brand.blue.deep },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand.mist,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.blue.deep },
  infoRows: { gap: 8, width: "100%" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontFamily: "Geist_500Medium", fontSize: 14, color: colors.brand.ink },
  actionRow: { flexDirection: "row", gap: 10, width: "100%" },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brand.mist,
    borderRadius: 10,
    padding: 10
  },
  actionBtnText: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.blue.deep },
  loanCard: {
    backgroundColor: colors.brand.white,
    borderRadius: radii.card,
    padding: 16,
    gap: 12
  },
  loanHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  loanHeaderLeft: { gap: 2 },
  loanTitle: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.ink },
  loanSub: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.text.secondary },
  loanMeta: { flexDirection: "row", justifyContent: "space-between" },
  loanMetaLeft: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.ink },
  loanMetaRight: { fontFamily: "Geist_700Bold", fontSize: 12, color: colors.brand.blue.deep },
  visitList: { gap: 8 },
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brand.white,
    borderRadius: 10,
    padding: 10
  },
  visitDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  visitTextWrap: { flex: 1 },
  visitTitle: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.ink },
  visitDate: { fontFamily: "Geist_500Medium", fontSize: 11, color: colors.text.secondary }
});
