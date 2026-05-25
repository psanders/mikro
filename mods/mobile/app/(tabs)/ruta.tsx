/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../lib/theme";
import { ClientRow } from "../../components/ui/ClientRow";
import { Chip } from "../../components/ui/Chip";
import { Header } from "../../components/ui/Header";
import { trpc } from "../../lib/api";

type FilterKey = "all" | "pending" | "late" | "done";

function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO")}`;
}

function formatDate(): string {
  const now = new Date();
  const day = now.toLocaleDateString("es-DO", { weekday: "long" });
  const date = now.toLocaleDateString("es-DO", { day: "numeric", month: "long" });
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${date}`;
}

function displayName(v: { customerName: string; loanNickname: string | null }): string {
  return v.loanNickname ?? v.customerName;
}

export default function RutaScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const dashboard = trpc.getCollectorDashboard.useQuery();
  const visits = dashboard.data?.visits ?? [];

  const counts = useMemo(() => {
    let pending = 0;
    let late = 0;
    let done = 0;
    for (const v of visits) {
      if (v.paidToday) done++;
      else if (v.isOverdue) late++;
      else pending++;
    }
    return { all: visits.length, pending, late, done };
  }, [visits]);

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case "pending":
        return visits.filter((v) => !v.paidToday && !v.isOverdue);
      case "late":
        return visits.filter((v) => !v.paidToday && v.isOverdue);
      case "done":
        return visits.filter((v) => v.paidToday);
      default:
        return visits;
    }
  }, [visits, activeFilter]);

  const filters: Array<{
    key: FilterKey;
    label: string;
    variant: "default" | "warning" | "danger";
    testID: string;
  }> = [
    { key: "all", label: `Todas · ${counts.all}`, variant: "default", testID: "filter-all" },
    {
      key: "pending",
      label: `Pendientes · ${counts.pending}`,
      variant: "default",
      testID: "filter-pending"
    },
    { key: "late", label: `Atrasadas · ${counts.late}`, variant: "warning", testID: "filter-late" },
    { key: "done", label: `Hechas · ${counts.done}`, variant: "default", testID: "filter-done" }
  ];

  return (
    <View style={styles.screen}>
      <Header title="Mi ruta" subtitle={`${formatDate()} · ${counts.all} cobros`} />

      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {filters.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              active={activeFilter === f.key}
              variant={f.variant}
              testID={f.testID}
              onPress={() => setActiveFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.isRefetching}
            onRefresh={() => dashboard.refetch()}
            tintColor={colors.brand.blue.primary}
          />
        }
      >
        {dashboard.isLoading && <Text style={styles.emptyText}>Cargando...</Text>}
        {dashboard.isError && <Text style={styles.emptyText}>No se pudo cargar la ruta.</Text>}
        {filtered.length === 0 && dashboard.isSuccess && (
          <Text style={styles.emptyText}>No hay visitas en esta categoría.</Text>
        )}
        {filtered.map((v) => (
          <ClientRow
            key={v.loanId}
            testID={`visit-${v.loanId}`}
            name={displayName(v)}
            business={v.loanNickname ? v.customerName : ""}
            meta={
              v.paidToday
                ? v.address
                  ? `Cobrado · ${v.address}`
                  : "Cobrado"
                : v.isOverdue
                  ? v.address
                    ? `${v.daysOverdue} días atraso · ${v.address}`
                    : `${v.daysOverdue} días atraso`
                  : v.address
                    ? `Hoy · ${v.address}`
                    : "Hoy"
            }
            amount={formatRD(v.paidToday ? v.amountPaidToday : v.paymentAmount)}
            amountSub={!v.paidToday && v.isOverdue ? "+ mora" : undefined}
            variant={v.paidToday ? "done" : v.isOverdue ? "overdue" : "default"}
            onPress={() => router.push(`/cliente/${v.customerId}`)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  chipRow: { height: 44 },
  chips: { paddingHorizontal: 20, paddingVertical: 6, gap: 8, alignItems: "center" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 10 },
  emptyText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    paddingVertical: 20
  }
});
