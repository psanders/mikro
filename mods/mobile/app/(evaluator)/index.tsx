/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 01 Inicio (Hoy)` (ppOwg): hero progress card, quick
 * actions to Cola/Buscar/Historial, and a "Más prometedoras" preview list.
 */
import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListChecks, Search, History } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { trpc } from "../../lib/api";
import { getUserName } from "../../lib/auth";
import { Avatar } from "../../components/ui/Avatar";
import { QuickAction } from "../../components/ui/QuickAction";
import { SolicitudRow } from "../../components/ui/SolicitudRow";
import {
  applicantName,
  isForbidden,
  isUrgent,
  riskRowLabel,
  riskRowVariant,
  timeAgo
} from "../../lib/applications";

function formatDate(): string {
  const now = new Date();
  const day = now.toLocaleDateString("es-DO", { weekday: "long" });
  const date = now.toLocaleDateString("es-DO", { day: "numeric", month: "long" });
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${date}`;
}

export default function EvaluadorInicioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");

  useEffect(() => {
    getUserName().then((n) => setName(n ?? ""));
  }, []);

  // Inicio's hero reads off the live RECEIVED/IN_REVIEW queue — there's no
  // dedicated "evaluations completed today" endpoint on the backend, so
  // "evaluadas" is approximated as already-claimed (IN_REVIEW) applications
  // out of the full active queue, and "pendientes" as untouched (RECEIVED)
  // ones. "Urgentes" is the near-48h-SLA subset (see lib/applications.ts).
  const receivedQ = trpc.listApplications.useQuery({ status: "RECEIVED", limit: 100 });
  const inReviewQ = trpc.listApplications.useQuery({ status: "IN_REVIEW", limit: 100 });

  const isLoading = receivedQ.isPending || inReviewQ.isPending;
  const isError = receivedQ.isError || inReviewQ.isError;
  const forbidden = isForbidden(receivedQ.error) || isForbidden(inReviewQ.error);

  const queue = useMemo(() => {
    return [...(receivedQ.data ?? []), ...(inReviewQ.data ?? [])];
  }, [receivedQ.data, inReviewQ.data]);

  const total = queue.length;
  const evaluated = inReviewQ.data?.length ?? 0;
  const pending = receivedQ.data?.length ?? 0;
  const urgent = queue.filter((a) => isUrgent(a.createdAt)).length;
  const progress = total > 0 ? evaluated / total : 0;
  const pct = Math.round(progress * 100);

  const promising = useMemo(() => {
    return [...queue]
      .filter((a) => a.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 3);
  }, [queue]);

  async function refresh() {
    await Promise.all([receivedQ.refetch(), inReviewQ.refetch()]);
  }

  const firstName = name.split(" ")[0] ?? "";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={
        <RefreshControl
          refreshing={receivedQ.isRefetching || inReviewQ.isRefetching}
          onRefresh={refresh}
          tintColor={colors.brand.blue.primary}
        />
      }
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.dateLine}>{formatDate()}</Text>
          <Text style={styles.greeting}>Buenos días, {firstName || "..."}.</Text>
        </View>
        <Pressable onPress={() => router.push("/perfil")} testID="avatar-perfil">
          <Avatar name={name || "?"} size={40} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>EVALUACIONES DE HOY</Text>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroNumber}>{evaluated}</Text>
              <Text style={styles.heroSub}>de {total} solicitudes evaluadas</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{pct}%</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%` }]} />
          </View>
          <View style={styles.heroMeta}>
            <Text style={styles.heroMetaLeft}>{pending} pendientes</Text>
            <Text style={styles.heroMetaRight}>{urgent} urgentes</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <QuickAction
            icon={ListChecks}
            label="Cola"
            iconColor={colors.brand.blue.primary}
            onPress={() => router.push("/(evaluator)/cola")}
          />
          <QuickAction
            icon={Search}
            label="Buscar"
            iconColor={colors.brand.blue.primary}
            onPress={() => router.push("/(evaluator)/buscar")}
          />
          <QuickAction
            icon={History}
            label="Historial"
            iconColor={colors.brand.blue.primary}
            onPress={() => router.push("/(evaluator)/historial")}
          />
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Más prometedoras</Text>
          <Pressable onPress={() => router.push("/(evaluator)/cola")}>
            <Text style={styles.listLink}>Ver todas</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {isLoading && <Text style={styles.emptyText}>Cargando...</Text>}
          {!isLoading && isError && (
            <Text style={styles.errorText}>
              {forbidden
                ? "No tienes acceso a las solicitudes. Pide a un administrador el rol de revisor."
                : "No se pudieron cargar las solicitudes."}
            </Text>
          )}
          {!isLoading && !isError && promising.length === 0 && (
            <Text style={styles.emptyText}>Sin solicitudes evaluadas todavía.</Text>
          )}
          {promising.map((a) => (
            <SolicitudRow
              key={a.id}
              testID={`promising-${a.id}`}
              name={applicantName(a)}
              business={[a.businessName, a.province].filter(Boolean).join(" · ")}
              meta={`Enviada hace ${timeAgo(a.createdAt)}`}
              riskLabel={riskRowLabel(a.riskBand, a.score)}
              riskVariant={riskRowVariant(a.riskBand, a.score)}
              score={a.score ?? 0}
              onPress={() => router.push(`/solicitud/${a.id}`)}
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
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.brand.blue.primary,
    width: "100%",
    overflow: "hidden"
  },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: colors.brand.white },
  heroMeta: { flexDirection: "row", justifyContent: "space-between" },
  heroMetaLeft: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.white },
  heroMetaRight: { fontFamily: "Geist_500Medium", fontSize: 13, color: "#9DB9F0" },
  quickActions: { flexDirection: "row", gap: 10 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  listTitle: { fontFamily: "Geist_700Bold", fontSize: 16, color: colors.brand.blue.deep },
  listLink: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.blue.primary },
  list: { gap: 10 },
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
