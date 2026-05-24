/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { colors } from "../lib/theme";
import { Header } from "../components/ui/Header";
import { KvRow } from "../components/ui/KvRow";

export default function SincronizarScreen() {
  return (
    <View style={styles.screen}>
      <Header title="Sincronizar" subtitle="Datos entre tu equipo y la oficina" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.connCard}>
          <View style={styles.connDot} />
          <Text style={styles.connTitle}>Conectado</Text>
          <Text style={styles.connSub}>· Última: hoy, 7:42 AM</Text>
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
          <View style={styles.lastSync}>
            <Text style={styles.lastSyncIcon}>⟳</Text>
            <Text style={styles.lastSyncText}>
              Última: hoy 7:42 AM · 40 clientes · 38 préstamos
            </Text>
          </View>
          <Pressable style={styles.syncBtn}>
            <Text style={styles.syncBtnText}>Recibir datos</Text>
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
            <View style={styles.badge}>
              <Text style={styles.badgeText}>14</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>
            Sube lo registrado hoy. Sin enviar, la oficina no ve los pagos ni las promesas.
          </Text>
          <View style={styles.pendingBox}>
            <KvRow label="Cobros pendientes" value="8" />
            <KvRow label="Visitas anotadas" value="4" />
            <KvRow label="Promesas de pago" value="2" />
          </View>
          <Pressable style={styles.syncBtn}>
            <Text style={styles.syncBtnText}>Enviar cambios</Text>
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
    borderRadius: 4,
    backgroundColor: "#10B981"
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
