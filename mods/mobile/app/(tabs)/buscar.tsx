/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, History, X, ChevronRight } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { Avatar } from "../../components/ui/Avatar";

const RECENT_SEARCHES = ["María Rosa", "809-555"];

const CLIENTS = [
  { id: "c1", name: "María Rosa Peralta", meta: "Activo · 1 préstamo" },
  {
    id: "c2",
    name: "José Núñez",
    meta: "En mora · 1 préstamo",
    metaColor: colors.brand.orange.deep
  },
  { id: "c3", name: "Luis Pérez", meta: "Activo · 1 préstamo" }
];

export default function BuscarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Buscar cliente</Text>
        <View style={styles.searchBox}>
          <Search size={18} color={colors.brand.blue.primary} strokeWidth={2} />
          <Text style={styles.searchPlaceholder}>Nombre, teléfono o cédula…</Text>
        </View>
      </View>

      <View style={styles.content}>
        <SectionLabel>BÚSQUEDAS RECIENTES</SectionLabel>
        <View style={styles.recentList}>
          {RECENT_SEARCHES.map((term) => (
            <View key={term} style={styles.recentRow}>
              <History size={18} color={colors.text.secondary} strokeWidth={2} />
              <Text style={styles.recentText}>{term}</Text>
              <X size={18} color={colors.text.secondary} strokeWidth={2} />
            </View>
          ))}
        </View>

        <SectionLabel>MIS CLIENTES</SectionLabel>
        <View style={styles.clientList}>
          {CLIENTS.map((c) => (
            <Pressable
              key={c.id}
              style={styles.clientRow}
              onPress={() => router.push(`/cliente/${c.id}`)}
            >
              <Avatar name={c.name} size={36} />
              <View style={styles.clientMid}>
                <Text style={styles.clientName}>{c.name}</Text>
                <Text style={[styles.clientMeta, c.metaColor ? { color: c.metaColor } : undefined]}>
                  {c.meta}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.text.secondary} strokeWidth={2} />
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  header: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },
  title: { fontFamily: "Geist_700Bold", fontSize: 24, color: colors.brand.blue.deep },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brand.mist,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  searchPlaceholder: { fontFamily: "Geist_500Medium", fontSize: 15, color: colors.text.secondary },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  recentList: { gap: 8 },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 12
  },
  recentText: { flex: 1, fontFamily: "Geist_500Medium", fontSize: 14, color: colors.brand.ink },
  clientList: { gap: 8 },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 12
  },
  clientMid: { flex: 1, gap: 2 },
  clientName: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.ink },
  clientMeta: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.text.secondary }
});
