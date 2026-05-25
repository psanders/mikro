/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { colors } from "../lib/theme";
import { Header } from "../components/ui/Header";
import { KvRow } from "../components/ui/KvRow";
import { useSyncContext } from "../lib/offline/SyncProvider";

function formatSyncTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const time = `${h % 12 || 12}:${m} ${ampm}`;
  return isToday ? `hoy, ${time}` : `${d.getDate()}/${d.getMonth() + 1} ${time}`;
}

export default function SincronizarScreen() {
  const {
    isOnline,
    lastPullAt,
    pendingCount,
    pendingBreakdown,
    customerCount,
    loanCount,
    isPulling,
    isPushing,
    pull,
    push
  } = useSyncContext();

  return (
    <View style={styles.screen}>
      <Header title="Sincronizar" subtitle="Datos entre tu equipo y la oficina" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.connCard}>
          <View style={[styles.connDot, { backgroundColor: isOnline ? "#10B981" : "#7888A8" }]} />
          <Text style={styles.connTitle}>{isOnline ? "Conectado" : "Sin conexión"}</Text>
          {lastPullAt && <Text style={styles.connSub}>· Última: {formatSyncTime(lastPullAt)}</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconDown}>
              <Text style={styles.cardIconText}>↓</Text>
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Recibir del servidor</Text>
              <Text style={styles.cardSub}>Tu ruta, clientes y préstamos</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>
            Trae la última información de la oficina. Hazlo al iniciar tu día o antes de salir a
            ruta.
          </Text>
          {lastPullAt && (
            <View style={styles.lastSync}>
              <Text style={styles.lastSyncIcon}>⟳</Text>
              <Text style={styles.lastSyncText}>
                Última: {formatSyncTime(lastPullAt)} · {customerCount} clientes · {loanCount}{" "}
                préstamos
              </Text>
            </View>
          )}
          <Pressable
            style={[styles.syncBtn, (!isOnline || isPulling) && styles.syncBtnDisabled]}
            onPress={pull}
            disabled={!isOnline || isPulling}
          >
            {isPulling ? (
              <ActivityIndicator color={colors.brand.white} size="small" />
            ) : (
              <Text style={styles.syncBtnText}>Recibir datos</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconUp}>
              <Text style={styles.cardIconTextOrange}>↑</Text>
            </View>
            <View style={[styles.cardHeaderText, { flex: 1 }]}>
              <Text style={styles.cardTitle}>Enviar al servidor</Text>
              <Text style={styles.cardSub}>Cobros, visitas y promesas de la calle</Text>
            </View>
            {pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardDesc}>
            Sube lo registrado hoy. Sin enviar, la oficina no ve los pagos ni las promesas.
          </Text>
          <View style={styles.pendingBox}>
            <KvRow label="Cobros pendientes" value={String(pendingBreakdown.payments)} />
            <KvRow label="Visitas anotadas" value={String(pendingBreakdown.notes)} />
          </View>
          <Pressable
            style={[
              styles.syncBtn,
              (!isOnline || isPushing || pendingCount === 0) && styles.syncBtnDisabled
            ]}
            onPress={push}
            disabled={!isOnline || isPushing || pendingCount === 0}
          >
            {isPushing ? (
              <ActivityIndicator color={colors.brand.white} size="small" />
            ) : (
              <Text style={styles.syncBtnText}>Enviar cambios</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>ⓘ</Text>
          <Text style={styles.infoText}>
            Si pierdes señal, los cobros se guardan y se envían al volver la conexión.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  connCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
    paddingBottom: 8
  },
  connDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  connTitle: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.ink },
  connSub: { fontFamily: "Geist_500Medium", fontSize: 14, color: "#7888A8" },
  card: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 18,
    gap: 12
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIconDown: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brand.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  cardIconUp: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFF1D6",
    alignItems: "center",
    justifyContent: "center"
  },
  cardIconText: { fontFamily: "Geist_700Bold", fontSize: 20, color: colors.brand.blue.deep },
  cardIconTextOrange: {
    fontFamily: "Geist_700Bold",
    fontSize: 20,
    color: colors.brand.orange.deep
  },
  cardHeaderText: { gap: 2 },
  cardTitle: { fontFamily: "Geist_700Bold", fontSize: 16, color: colors.brand.ink },
  cardSub: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.text.secondary },
  cardDesc: {
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: colors.text.meta,
    lineHeight: 19
  },
  lastSync: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg.screen,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  lastSyncIcon: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.blue.deep },
  lastSyncText: { fontFamily: "Geist_600SemiBold", fontSize: 11, color: colors.brand.blue.deep },
  syncBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.white },
  badge: {
    backgroundColor: colors.brand.orange.deep,
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  badgeText: { fontFamily: "Geist_700Bold", fontSize: 12, color: colors.brand.white },
  pendingBox: {
    backgroundColor: colors.bg.screen,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6
  },
  infoRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4
  },
  infoIcon: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.text.secondary },
  infoText: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 16
  }
});
