/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 02 Cola` (BiMvn): RECEIVED/IN_REVIEW queue with filter
 * chips. `listApplications` only takes one status at a time (backend), so we
 * issue two parallel queries and merge client-side (mirrors desktop's
 * per-status querying in SolicitudesPage.tsx).
 *
 * The Pencil chip row also shows a "Borradores" (DRAFT) chip, but `spec.md`
 * ("mobile-evaluator-review-flow") scopes Cola to RECEIVED/IN_REVIEW only —
 * dropped that chip rather than add a third query outside spec.
 */
import { useMemo, useState } from "react";
import { Alert, View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../lib/theme";
import { trpc } from "../../lib/api";
import { Header } from "../../components/ui/Header";
import { Chip } from "../../components/ui/Chip";
import { SolicitudRow } from "../../components/ui/SolicitudRow";
import {
  applicantName,
  isForbidden,
  isUrgent,
  riskRowLabel,
  riskRowVariant,
  timeAgo
} from "../../lib/applications";

type FilterKey = "all" | "new" | "review" | "urgent";

export default function EvaluadorColaScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const utils = trpc.useUtils();

  const receivedQ = trpc.listApplications.useQuery({ status: "RECEIVED", limit: 100 });
  const inReviewQ = trpc.listApplications.useQuery({ status: "IN_REVIEW", limit: 100 });

  const claim = trpc.claimApplication.useMutation({
    onSuccess: () => {
      void utils.listApplications.invalidate();
    }
  });

  const isLoading = receivedQ.isPending || inReviewQ.isPending;
  const isError = receivedQ.isError || inReviewQ.isError;
  const forbidden = isForbidden(receivedQ.error) || isForbidden(inReviewQ.error);

  const merged = useMemo(() => {
    const list = [...(receivedQ.data ?? []), ...(inReviewQ.data ?? [])];
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [receivedQ.data, inReviewQ.data]);

  const counts = useMemo(
    () => ({
      all: merged.length,
      new: receivedQ.data?.length ?? 0,
      review: inReviewQ.data?.length ?? 0,
      urgent: merged.filter((a) => isUrgent(a.createdAt)).length
    }),
    [merged, receivedQ.data, inReviewQ.data]
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case "new":
        return merged.filter((a) => a.status === "RECEIVED");
      case "review":
        return merged.filter((a) => a.status === "IN_REVIEW");
      case "urgent":
        return merged.filter((a) => isUrgent(a.createdAt));
      default:
        return merged;
    }
  }, [merged, filter]);

  async function refresh() {
    await Promise.all([receivedQ.refetch(), inReviewQ.refetch()]);
  }

  function handleLongPress(id: string, name: string, status: string) {
    if (status !== "RECEIVED") return;
    Alert.alert("Tomar solicitud", `¿Tomar la solicitud de ${name}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Tomar", onPress: () => claim.mutate({ id }) }
    ]);
  }

  const chips: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: `Todas · ${counts.all}` },
    { key: "new", label: `Nuevas · ${counts.new}` },
    { key: "review", label: `Revisión · ${counts.review}` },
    { key: "urgent", label: `Urgentes · ${counts.urgent}` }
  ];

  return (
    <View style={styles.screen}>
      <Header
        title="Solicitudes"
        subtitle={`${counts.all} pendientes de evaluar`}
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
            refreshing={receivedQ.isRefetching || inReviewQ.isRefetching}
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
          <Text style={styles.emptyText}>No hay solicitudes para este filtro.</Text>
        )}
        {filtered.map((a) => (
          <SolicitudRow
            key={a.id}
            testID={`solicitud-${a.id}`}
            name={applicantName(a)}
            business={[a.businessName, a.province].filter(Boolean).join(" · ")}
            meta={`Enviada hace ${timeAgo(a.createdAt)}`}
            riskLabel={riskRowLabel(a.riskBand, a.score)}
            riskVariant={riskRowVariant(a.riskBand, a.score)}
            score={a.score ?? 0}
            onPress={() => router.push(`/solicitud/${a.id}`)}
            onLongPress={() => handleLongPress(a.id, applicantName(a), a.status)}
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
