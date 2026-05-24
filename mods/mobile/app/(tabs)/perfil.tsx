/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, ShieldCheck, LifeBuoy, LogOut } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";
import { Avatar } from "../../components/ui/Avatar";
import { StatCard } from "../../components/ui/StatCard";
import { ListTile } from "../../components/ui/ListTile";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { clearToken, clearPin } from "../../lib/auth";

export default function PerfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Mi cuenta</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.profileCard}>
          <Avatar name="Carlos Reyes" size={60} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Carlos Reyes</Text>
            <Text style={styles.profileRole}>Cobrador · Zona Norte</Text>
            <View style={styles.idPill}>
              <Text style={styles.idPillText}>ID #COB-0042</Text>
            </View>
          </View>
        </View>

        <SectionLabel>HOY</SectionLabel>
        <View style={styles.statsRow}>
          <StatCard value="8" label="Cobros" />
          <StatCard value="18.2K" label="Recaudado" />
          <StatCard value="12" label="Pendientes" />
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
            router.replace("/(auth)/login");
          }}
        >
          <LogOut size={16} color={colors.brand.orange.deep} strokeWidth={2} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>

        <Text style={styles.version}>Mikro Cobradores · v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontFamily: "Geist_700Bold", fontSize: 24, color: colors.brand.blue.deep },
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
  idPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    marginTop: 4
  },
  idPillText: { fontFamily: "Geist_700Bold", fontSize: 10, color: colors.brand.white },
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
