/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reviewer-only activity history for one application (mikro/#67), reached
 * from the "Ver actividad" row on `datos.tsx`. Backed by
 * `listApplicationEvents` (reviewerProcedure, scoped to one applicationId) —
 * never the business-wide founder feed, and never payment data.
 */
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Clock } from "lucide-react-native";
import { colors, radii } from "../../../lib/theme";
import { trpc } from "../../../lib/api";
import { Header } from "../../../components/ui/Header";
import { applicantName, isForbidden } from "../../../lib/applications";

function formatEventDate(value: string | Date): string {
  const d = new Date(value);
  const date = new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short" }).format(d);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${date} · ${h % 12 || 12}:${m} ${ampm}`;
}

export default function SolicitudActividadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const appQuery = trpc.getApplication.useQuery({ id });
  const eventsQuery = trpc.listApplicationEvents.useQuery(
    { applicationId: appQuery.data?.id ?? "" },
    { enabled: !!appQuery.data?.id }
  );

  const name = appQuery.data ? applicantName(appQuery.data) : "";
  const subtitle = name || undefined;
  const events = eventsQuery.data?.items ?? [];

  return (
    <View style={styles.screen}>
      <Header title="Actividad" subtitle={subtitle} fallbackRoute="/(evaluator)" />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={eventsQuery.isRefetching}
            onRefresh={() => eventsQuery.refetch()}
          />
        }
      >
        {(appQuery.isPending || eventsQuery.isPending) && (
          <Text style={styles.centerText}>Cargando...</Text>
        )}

        {appQuery.isError && (
          <Text style={styles.centerErrorText}>
            {isForbidden(appQuery.error)
              ? "No tienes acceso a esta solicitud."
              : appQuery.error.message}
          </Text>
        )}

        {eventsQuery.isSuccess && events.length === 0 && (
          <Text style={styles.centerText}>Sin actividad registrada todavía.</Text>
        )}

        {events.map((e) => (
          <View key={e.id} style={styles.row}>
            <View style={styles.iconWrap}>
              <Clock size={14} color={colors.brand.blue.primary} strokeWidth={2} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.summary}>{e.summary}</Text>
              <Text style={styles.meta}>
                {e.actorName} · {formatEventDate(e.occurredAt)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 8 },
  centerText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    paddingVertical: 40
  },
  centerErrorText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.brand.orange.deep,
    textAlign: "center",
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  row: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.brand.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.card,
    padding: 14
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  rowBody: { flex: 1, gap: 2 },
  summary: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.ink },
  meta: { fontFamily: "Geist_500Medium", fontSize: 11, color: colors.text.secondary }
});
