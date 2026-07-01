/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 05 Historial` (r1put): REJECTED/CONVERTED applications,
 * merged client-side from two parallel `listApplications` queries — same
 * pattern as Cola (task 3.2).
 *
 * Pencil's chip row also shows an "Aprobadas" chip, but `spec.md`
 * ("mobile-evaluator-review-flow") scopes Historial to the terminal
 * REJECTED/CONVERTED states only (matching the task's explicit "same
 * REJECTED+CONVERTED multi-status merge as 3.2" instruction) — dropped that
 * chip rather than show a filter with no backing data.
 */
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../lib/theme";
import { trpc } from "../../lib/api";
import { Header } from "../../components/ui/Header";
import { Chip } from "../../components/ui/Chip";
import { SolicitudRow } from "../../components/ui/SolicitudRow";
import {
  applicantName,
  isForbidden,
  statusMeta,
  timeAgo,
  toneToRowVariant
} from "../../lib/applications";

type FilterKey = "all" | "rejected" | "converted";

export default function EvaluadorHistorialScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");

  const rejectedQ = trpc.listApplications.useQuery({ status: "REJECTED", limit: 100 });
  const convertedQ = trpc.listApplications.useQuery({ status: "CONVERTED", limit: 100 });

  const isLoading = rejectedQ.isPending || convertedQ.isPending;
  const isError = rejectedQ.isError || convertedQ.isError;
  const forbidden = isForbidden(rejectedQ.error) || isForbidden(convertedQ.error);

  const merged = useMemo(() => {
    const list = [...(rejectedQ.data ?? []), ...(convertedQ.data ?? [])];
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [rejectedQ.data, convertedQ.data]);

  const counts = {
    all: merged.length,
    rejected: rejectedQ.data?.length ?? 0,
    converted: convertedQ.data?.length ?? 0
  };

  const filtered = useMemo(() => {
    if (filter === "rejected") return merged.filter((a) => a.status === "REJECTED");
    if (filter === "converted") return merged.filter((a) => a.status === "CONVERTED");
    return merged;
  }, [merged, filter]);

  async function refresh() {
    await Promise.all([rejectedQ.refetch(), convertedQ.refetch()]);
  }

  const chips: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: `Todas · ${counts.all}` },
    { key: "rejected", label: `Rechazadas · ${counts.rejected}` },
    { key: "converted", label: `Convertidas · ${counts.converted}` }
  ];

  return (
    <View style={styles.screen}>
      <Header
        title="Historial"
        subtitle={`${counts.all} solicitudes resueltas`}
        fallbackRoute="/(evaluator)"
      />

      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {chips.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              active={filter === c.key}
              testID={`filter-${c.key}`}
              onPress={() => setFilter(c.key)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={rejectedQ.isRefetching || convertedQ.isRefetching}
            onRefresh={refresh}
            tintColor={colors.brand.blue.primary}
          />
        }
      >
        {isLoading && <Text style={styles.emptyText}>Cargando...</Text>}
        {!isLoading && isError && (
          <Text style={styles.errorText}>
            {forbidden
              ? "No tienes acceso a las solicitudes. Pide a un administrador el rol de revisor."
              : "No se pudieron cargar las solicitudes."}
          </Text>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <Text style={styles.emptyText}>No hay solicitudes en esta categoría.</Text>
        )}
        {filtered.map((a) => {
          const st = statusMeta(a.status);
          const decisionDate = a.reviewedAt ?? a.updatedAt;
          return (
            <SolicitudRow
              key={a.id}
              testID={`solicitud-${a.id}`}
              name={applicantName(a)}
              business={[a.businessName, a.province].filter(Boolean).join(" · ")}
              meta={`${st.label} · hace ${timeAgo(decisionDate)}`}
              riskLabel={st.label}
              riskVariant={toneToRowVariant(st.tone)}
              score={a.score ?? 0}
              onPress={() => router.push(`/solicitud/${a.id}`)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  chipRow: { height: 44 },
  chips: { paddingHorizontal: 20, paddingVertical: 6, gap: 8, alignItems: "center" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 12 },
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
