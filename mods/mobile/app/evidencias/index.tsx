/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Evidencias por recoger (Pencil rlZQ6 / empty m1mC3o): every application in
 * review, oldest first, with how much evidence is in. Any collector can pick
 * any of them; complete ones stay (marked) until they leave review. Online
 * only — uploads need a connection.
 */
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, CircleCheckBig, Info, MapPin, RefreshCw, WifiOff } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { Avatar } from "../../components/ui/Avatar";
import { trpc } from "../../lib/api";
import { inReviewLabel } from "../../lib/evidence";
import { useSyncContext } from "../../lib/offline/SyncProvider";

export default function EvidenciasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isOnline } = useSyncContext();
  const queue = trpc.listEvidenceQueue.useQuery(undefined, { enabled: isOnline });
  const items = queue.data ?? [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header
        title="Evidencias por recoger"
        subtitle={
          items.length
            ? `${items.length} solicitud${items.length > 1 ? "es" : ""} en evaluación`
            : "Nada pendiente"
        }
        rightIcon={RefreshCw}
        onRightPress={() => void queue.refetch()}
        fallbackRoute="/(tabs)"
      />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={queue.isRefetching}
            onRefresh={() => void queue.refetch()}
            tintColor={colors.brand.blue.primary}
          />
        }
      >
        {!isOnline ? (
          <View style={styles.notice}>
            <WifiOff size={16} color={colors.status.warning} />
            <Text style={styles.noticeText}>
              Sin conexión. Las evidencias se recogen con internet.
            </Text>
          </View>
        ) : queue.isPending ? (
          <Text style={styles.muted}>Cargando…</Text>
        ) : queue.isError ? (
          <Text style={styles.muted}>No se pudo cargar la lista. Desliza para reintentar.</Text>
        ) : items.length === 0 ? (
          <View style={styles.empty} testID="evidence-empty">
            <View style={styles.emptyIcon}>
              <CircleCheckBig size={34} color={colors.status.success} />
            </View>
            <Text style={styles.emptyTitle}>No hay evidencias por recoger</Text>
            <Text style={styles.emptyText}>
              Cuando una solicitud entre en evaluación y le falte evidencia, aparecerá aquí.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.hint}>
              <Info size={16} color={colors.brand.blue.primary} />
              <Text style={styles.hintText}>
                Cualquier cobrador puede recogerlas. Al salir de evaluación desaparecen de aquí.
              </Text>
            </View>
            {items.map((item) => {
              const name = [item.firstName, item.lastName].filter(Boolean).join(" ") || "Solicitud";
              const pct = item.progress.need ? item.progress.have / item.progress.need : 0;
              return (
                <Pressable
                  key={item.id}
                  testID={`evidence-row-${item.id}`}
                  onPress={() => router.push(`/evidencias/${item.id}`)}
                  style={[styles.row, item.complete && styles.rowDone]}
                >
                  <Avatar name={name} />
                  <View style={styles.rowMid}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {name}
                    </Text>
                    {item.businessName ? (
                      <Text style={styles.rowBiz} numberOfLines={1}>
                        {item.businessName}
                      </Text>
                    ) : null}
                    <View style={styles.rowAddr}>
                      <MapPin size={12} color={colors.text.secondary} />
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {item.homeAddress ?? "Sin dirección"}
                      </Text>
                    </View>
                    <Text style={styles.rowAge}>{inReviewLabel(item.inReviewSince)}</Text>
                  </View>
                  <View style={styles.rowTrail}>
                    {item.complete ? (
                      <View style={styles.donePill}>
                        <Check size={12} color={colors.status.success} />
                        <Text style={styles.doneText}>Completa</Text>
                      </View>
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.count,
                            item.progress.have === 0 && { color: colors.brand.orange.deep }
                          ]}
                        >
                          {item.progress.have} de {item.progress.need}
                        </Text>
                        <View style={styles.bar}>
                          <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%` }]} />
                        </View>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  body: { paddingHorizontal: 20, paddingTop: 4, gap: 10 },
  muted: { fontFamily: "Geist_500Medium", fontSize: 13, color: colors.text.secondary },
  notice: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.status.warningBg
  },
  noticeText: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: colors.status.warning
  },
  hint: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.brand.mist
  },
  hintText: { flex: 1, fontFamily: "Geist_500Medium", fontSize: 12, color: colors.brand.blue.deep },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.brand.white,
    borderWidth: 1,
    borderColor: colors.border.light
  },
  rowDone: { backgroundColor: "#F7FBF8", borderColor: "#CFEBD9" },
  rowMid: { flex: 1, gap: 3 },
  rowName: { fontFamily: "Geist_700Bold", fontSize: 15, color: colors.brand.ink },
  rowBiz: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.blue.deep },
  rowAddr: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowMeta: { flex: 1, fontFamily: "Geist_400Regular", fontSize: 12, color: colors.text.secondary },
  rowAge: { fontFamily: "Geist_400Regular", fontSize: 11, color: "#9AA8BF" },
  rowTrail: { alignItems: "flex-end", gap: 6 },
  count: { fontFamily: "Geist_700Bold", fontSize: 13, color: colors.brand.blue.deep },
  bar: {
    width: 56,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.mist,
    overflow: "hidden"
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.brand.orange.primary },
  donePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 9999,
    backgroundColor: colors.status.successBg
  },
  doneText: { fontFamily: "Geist_700Bold", fontSize: 11, color: colors.status.success },
  empty: { alignItems: "center", gap: 14, paddingTop: 120, paddingHorizontal: 20 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.status.successBg,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: { fontFamily: "Geist_700Bold", fontSize: 17, color: colors.brand.ink },
  emptyText: {
    fontFamily: "Geist_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.secondary,
    textAlign: "center"
  }
});
