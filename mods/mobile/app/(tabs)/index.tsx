/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MapPin,
  Search,
  Calculator,
  UserPlus,
  CircleCheck,
  WifiOff,
  RefreshCw
} from "lucide-react-native";
import { colors } from "../../lib/theme";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { QuickAction } from "../../components/ui/QuickAction";
import { ClientRow } from "../../components/ui/ClientRow";
import { useLocalDashboard } from "../../lib/offline/hooks";
import { useSyncContext } from "../../lib/offline/SyncProvider";

function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO")}`;
}

function formatDate(): string {
  const now = new Date();
  const day = now.toLocaleDateString("es-DO", { weekday: "long" });
  const date = now.toLocaleDateString("es-DO", { day: "numeric", month: "long" });
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${date}`;
}

function formatDueLabel(iso: string): string {
  const due = new Date(iso);
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const diffDays = Math.round((due.getTime() - todayStart.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  const day = due.toLocaleDateString("es-DO", { weekday: "long", timeZone: "UTC" });
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dashboard = useLocalDashboard();
  const { isOnline, isPulling, isPushing, pull } = useSyncContext();
  const isSyncing = isPulling || isPushing;

  const data = dashboard.data;
  const upcomingVisits = useMemo(() => {
    const pending =
      data?.visits.filter((v) => !v.paidToday && v.installmentNumber <= v.termLength) ?? [];
    return [...pending].sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? 1 : -1;
      if (!a.isOverdue)
        return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
      return b.daysOverdue - a.daysOverdue;
    });
  }, [data?.visits]);
  const firstName = data?.collector.name.split(" ")[0] ?? "...";
  const dailyTarget = data?.dailyTarget ?? 0;
  const amountCollected = data?.amountCollected ?? 0;
  const progress = dailyTarget > 0 ? amountCollected / dailyTarget : 0;
  const pct = Math.round(progress * 100);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={
        <RefreshControl
          refreshing={isPulling}
          onRefresh={pull}
          tintColor={colors.brand.blue.primary}
        />
      }
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.dateRow}>
            <Text style={styles.dateLine}>{formatDate()}</Text>
            <View
              style={[
                styles.statusPill,
                isSyncing
                  ? styles.statusPillSyncing
                  : isOnline
                    ? styles.statusPillOnline
                    : styles.statusPillOffline
              ]}
            >
              {isSyncing ? (
                <RefreshCw size={10} color="#1D6FD0" />
              ) : isOnline ? (
                <CircleCheck size={10} color="#0E7C5F" />
              ) : (
                <WifiOff size={10} color="#7888A8" />
              )}
              <Text
                style={[
                  styles.statusPillText,
                  isSyncing
                    ? styles.statusTextSyncing
                    : isOnline
                      ? styles.statusTextOnline
                      : styles.statusTextOffline
                ]}
              >
                {isSyncing ? "Sincronizando..." : isOnline ? "Conectado" : "Desconectado"}
              </Text>
            </View>
          </View>
          <Text style={styles.greeting}>Hola, {firstName}.</Text>
        </View>
        <Pressable style={styles.avatarCircle} onPress={() => router.push("/perfil")}>
          <Text style={styles.avatarText}>
            {data?.collector.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() ?? ""}
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>META DE HOY</Text>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroNumber}>{formatRD(amountCollected)}</Text>
              <Text style={styles.heroSub}>de {formatRD(dailyTarget)} cobrados</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{pct}%</Text>
            </View>
          </View>
          <ProgressBar
            progress={progress}
            color={colors.brand.white}
            trackColor={colors.brand.blue.primary}
          />
          <View style={styles.heroMeta}>
            <Text style={styles.heroMetaLeft}>{data?.visitsDone ?? 0} clientes</Text>
            <Text style={styles.heroMetaRight}>{data?.visitsPending ?? 0} pendientes</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <QuickAction
            icon={MapPin}
            label="Mi ruta"
            iconColor={colors.brand.orange.deep}
            onPress={() => router.push("/(tabs)/ruta")}
          />
          <QuickAction
            icon={Search}
            label="Buscar"
            iconColor={colors.brand.blue.primary}
            onPress={() => router.push("/(tabs)/buscar")}
          />
          <QuickAction
            icon={Calculator}
            label="Cuadre"
            iconColor={colors.brand.blue.primary}
            onPress={() => router.push("/(tabs)/cuadre")}
          />
          <QuickAction
            icon={UserPlus}
            label="Promocionar"
            iconColor={colors.brand.orange.deep}
            onPress={() => router.push("/promocionar")}
          />
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Próximas visitas</Text>
          <Pressable onPress={() => router.push("/(tabs)/ruta")}>
            <Text style={styles.listLink}>Ver todas</Text>
          </Pressable>
        </View>

        <View style={styles.clientList}>
          {dashboard.isLoading && <Text style={styles.emptyText}>Cargando...</Text>}
          {!dashboard.isLoading && !data && (
            <Pressable onPress={pull}>
              <Text style={styles.errorText}>Sin datos. Sincroniza para comenzar.</Text>
            </Pressable>
          )}
          {upcomingVisits.length === 0 && dashboard.isSuccess && (
            <Text style={styles.emptyText}>No hay visitas pendientes hoy.</Text>
          )}
          {upcomingVisits.slice(0, 4).map((v) => (
            <ClientRow
              key={v.loanId}
              name={v.loanNickname ?? v.customerName}
              business={v.loanNickname ? v.customerName : ""}
              meta={
                v.address
                  ? `${v.address} · Cuota ${v.installmentNumber}/${v.termLength}`
                  : `Cuota ${v.installmentNumber}/${v.termLength}`
              }
              amount={formatRD(v.paymentAmount)}
              amountSub={v.isOverdue ? `Mora · ${v.daysOverdue}d` : formatDueLabel(v.nextDueDate)}
              variant={v.isOverdue ? "overdue" : "default"}
              onPress={() => router.push(`/cliente/${v.customerId}`)}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12
  },
  headerLeft: { gap: 2 },
  dateRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  dateLine: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.text.secondary },
  statusPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: 99,
    paddingVertical: 2,
    paddingHorizontal: 6,
    gap: 4
  },
  statusPillOnline: { backgroundColor: "#D6F3E5" },
  statusPillOffline: { backgroundColor: "#E8ECF1" },
  statusPillSyncing: { backgroundColor: "#DBEAFE" },
  statusPillText: { fontSize: 10, fontFamily: "Geist_600SemiBold" },
  statusTextOnline: { color: "#0E7C5F" },
  statusTextOffline: { color: "#7888A8" },
  statusTextSyncing: { color: "#1D6FD0" },
  greeting: { fontFamily: "Geist_700Bold", fontSize: 24, color: colors.brand.blue.deep },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.blue.deep,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.yellow.accent },
  body: { paddingHorizontal: 20, gap: 18 },
  hero: {
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 18,
    padding: 20,
    gap: 14
  },
  heroLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#9DB9F0"
  },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  heroNumber: {
    fontFamily: "Geist_700Bold",
    fontSize: 32,
    color: colors.brand.white,
    letterSpacing: -1
  },
  heroSub: { fontFamily: "Geist_500Medium", fontSize: 13, color: "#9DB9F0" },
  heroPill: {
    backgroundColor: colors.brand.white,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  heroPillText: { fontFamily: "Geist_700Bold", fontSize: 13, color: colors.brand.blue.deep },
  heroMeta: { flexDirection: "row", justifyContent: "space-between" },
  heroMetaLeft: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.white },
  heroMetaRight: { fontFamily: "Geist_500Medium", fontSize: 13, color: "#9DB9F0" },
  quickActions: { flexDirection: "row", gap: 10 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  listTitle: { fontFamily: "Geist_700Bold", fontSize: 16, color: colors.brand.blue.deep },
  listLink: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.blue.primary },
  clientList: { gap: 10 },
  emptyText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    paddingVertical: 20
  },
  errorText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.brand.orange.deep,
    textAlign: "center",
    paddingVertical: 20
  }
});
