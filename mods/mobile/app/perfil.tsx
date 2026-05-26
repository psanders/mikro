/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Bell, ShieldCheck, LifeBuoy, LogOut } from "lucide-react-native";
import { colors, radii } from "../lib/theme";
import { Header } from "../components/ui/Header";
import { Avatar } from "../components/ui/Avatar";
import { StatCard } from "../components/ui/StatCard";
import { ListTile } from "../components/ui/ListTile";
import { SectionLabel } from "../components/ui/SectionLabel";
import { clearToken, clearPin, clearUserName } from "../lib/auth";
import { trpc } from "../lib/api";

function formatRD(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(amount);
}

export default function PerfilScreen() {
  const router = useRouter();
  const dashboard = trpc.getCollectorDashboard.useQuery();

  const appVersion = Constants.expoConfig?.version ?? "0.1.0";
  const data = dashboard.data;
  const name = data?.collector.name ?? "...";
  const activeLoans = data?.visits.length ?? 0;

  return (
    <View style={styles.screen}>
      <Header title="Mi cuenta" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.body}>
          <View style={styles.profileCard}>
            <Avatar name={name} size={60} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{name}</Text>
              <Text style={styles.profileRole}>Cobrador · {activeLoans} préstamos activos</Text>
            </View>
          </View>

          <SectionLabel>HOY</SectionLabel>
          <View style={styles.statsRow}>
            <StatCard value={String(data?.visitsDone ?? 0)} label="Cobros" />
            <StatCard value={formatRD(data?.amountCollected ?? 0)} label="Recaudado" />
            <StatCard value={String(data?.visitsPending ?? 0)} label="Pendientes" />
          </View>

          <SectionLabel>AJUSTES</SectionLabel>
          <View style={styles.settingsGroup}>
            <ListTile icon={Bell} label="Notificaciones" />
            <ListTile icon={ShieldCheck} label="Seguridad y PIN" />
            <ListTile icon={LifeBuoy} label="Ayuda y soporte" />
          </View>

          <Pressable
            style={styles.logoutBtn}
            onPress={async () => {
              await clearToken();
              await clearPin();
              await clearUserName();
              router.replace("/(auth)/login");
            }}
          >
            <LogOut size={16} color={colors.brand.orange.deep} strokeWidth={2} />
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>

          <Text style={styles.version}>Mikro Cobradores · v{appVersion}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  body: { paddingHorizontal: 20, gap: 18 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 18,
    padding: 18
  },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontFamily: "Geist_700Bold", fontSize: 18, color: colors.brand.white },
  profileRole: { fontFamily: "Geist_500Medium", fontSize: 12, color: "#9DB9F0" },
  statsRow: { flexDirection: "row", gap: 10 },
  settingsGroup: {
    borderRadius: radii.card,
    overflow: "hidden",
    backgroundColor: colors.brand.white
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.brand.orange.deep
  },
  logoutText: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.orange.deep },
  version: {
    fontFamily: "Geist_500Medium",
    fontSize: 11,
    color: "#9AA8C2",
    textAlign: "center"
  }
});
