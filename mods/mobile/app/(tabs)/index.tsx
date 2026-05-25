/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin, Search, Calculator } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { QuickAction } from "../../components/ui/QuickAction";
import { ClientRow } from "../../components/ui/ClientRow";
import { trpc } from "../../lib/api";

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

function formatSyncTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `hoy ${h % 12 || 12}:${m} ${ampm}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dashboard = trpc.getCollectorDashboard.useQuery();

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
          refreshing={dashboard.isRefetching}
          onRefresh={() => dashboard.refetch()}
          tintColor={colors.brand.blue.primary}
        />
      }
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.dateLine}>{formatDate()}</Text>
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
        <Pressable style={styles.syncChip} onPress={() => router.push("/sincronizar")}>
          <View
            style={[
              styles.syncDot,
              { backgroundColor: dashboard.isSuccess ? "#10B981" : colors.text.secondary }
            ]}
          />
          <View style={styles.syncTextWrap}>
            <Text style={styles.syncTitle}>
              {dashboard.isSuccess
                ? `Sincronizado · ${formatSyncTime(dashboard.dataUpdatedAt)}`
                : "Conectando..."}
            </Text>
          </View>
          <Text style={styles.syncArrow}>›</Text>
        </Pressable>

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
            <Text style={styles.heroMetaLeft}>{data?.visitsDone ?? 0} cobros realizados</Text>
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
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Próximas visitas</Text>
          <Pressable onPress={() => router.push("/(tabs)/ruta")}>
            <Text style={styles.listLink}>Ver todas</Text>
          </Pressable>
        </View>

        <View style={styles.clientList}>
          {dashboard.isLoading && <Text style={styles.emptyText}>Cargando...</Text>}
          {dashboard.isError && (
            <Pressable onPress={() => dashboard.refetch()}>
              <Text style={styles.errorText}>No se pudo cargar. Toca para reintentar.</Text>
            </Pressable>
          )}
          {upcomingVisits.length === 0 && dashboard.isSuccess && (
            <Text style={styles.emptyText}>No hay visitas pendientes hoy.</Text>
          )}
          {upcomingVisits.slice(0, 3).map((v) => (
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
  dateLine: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.text.secondary },
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
  syncChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border.light
  },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  syncTextWrap: { flex: 1, gap: 1 },
  syncTitle: { fontFamily: "Geist_700Bold", fontSize: 12, color: colors.brand.ink },
  syncArrow: { fontFamily: "Geist_700Bold", fontSize: 16, color: colors.text.secondary },
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
