/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useMemo } from "react";
import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Phone,
  MapPin,
  IdCard,
  MessageCircle,
  Map,
  ChevronRight,
  Check
} from "lucide-react-native";
import { colors, radii } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { Avatar } from "../../components/ui/Avatar";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { trpc } from "../../lib/api";

function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO")}`;
}

function formatPaymentDate(d: string | Date): string {
  const date = new Date(d);
  const day = date.getDate();
  const month = date.toLocaleDateString("es-DO", { month: "short" }).replace(".", "");
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${day} ${month} · ${h % 12 || 12}:${m} ${ampm}`;
}

export default function ClienteDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const customer = trpc.getCustomer.useQuery({ id: id! }, { enabled: !!id });
  const dashboard = trpc.getCollectorDashboard.useQuery();

  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 90);
    return { startDate: start, endDate: end };
  }, []);
  const payments = trpc.listPaymentsByCustomer.useQuery(
    { customerId: id!, ...dateRange },
    { enabled: !!id }
  );

  const visits = useMemo(() => {
    return (dashboard.data?.visits ?? []).filter((v) => v.customerId === id);
  }, [dashboard.data?.visits, id]);

  const c = customer.data;
  const hasOverdue = visits.some((v) => v.isOverdue);
  const sinceYear = c ? new Date(c.createdAt).getFullYear() : null;

  const recentPayments = useMemo(() => {
    return (payments.data ?? [])
      .filter((p) => p.status !== "REVERSED" && p.kind === "INSTALLMENT")
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
      .slice(0, 5);
  }, [payments.data]);

  return (
    <View style={styles.screen}>
      <Header title="Cliente" rightIcon={Phone} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <Avatar name={c?.nickname ?? c?.name ?? "..."} size={72} />
          <Text style={styles.profileName}>{c?.nickname ?? c?.name ?? "..."}</Text>
          {c?.nickname && <Text style={styles.profileLegal}>{c.name}</Text>}
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: hasOverdue ? colors.brand.orange.deep : colors.brand.blue.primary
                }
              ]}
            />
            <Text style={styles.statusText}>
              {hasOverdue ? "En mora" : "Al día"}
              {sinceYear ? ` · Cliente desde ${sinceYear}` : ""}
            </Text>
          </View>

          <View style={styles.infoRows}>
            {c?.phone && (
              <View style={styles.infoRow}>
                <Phone size={16} color={colors.brand.blue.primary} strokeWidth={2} />
                <Text style={styles.infoText}>{c.phone}</Text>
              </View>
            )}
            {(c?.collectionPoint || c?.homeAddress) && (
              <View style={styles.infoRow}>
                <MapPin size={16} color={colors.brand.blue.primary} strokeWidth={2} />
                <Text style={styles.infoText}>{c.collectionPoint || c.homeAddress}</Text>
              </View>
            )}
            {c?.idNumber && (
              <View style={styles.infoRow}>
                <IdCard size={16} color={colors.brand.blue.primary} strokeWidth={2} />
                <Text style={styles.infoText}>Cédula {c.idNumber}</Text>
              </View>
            )}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                if (!c?.phone) return;
                Linking.openURL(`tel:${c.phone}`).catch(() => {});
              }}
            >
              <Phone size={16} color={colors.brand.blue.deep} strokeWidth={2} />
              <Text style={styles.actionBtnText}>Llamar</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                if (!c?.phone) return;
                const digits = c.phone.replace(/\D/g, "");
                Linking.openURL(`https://wa.me/${digits}`).catch(() => {});
              }}
            >
              <MessageCircle size={16} color={colors.brand.blue.deep} strokeWidth={2} />
              <Text style={styles.actionBtnText}>WhatsApp</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                const addr = c?.collectionPoint || c?.homeAddress;
                if (!addr) return;
                Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(addr)}`).catch(
                  () => {}
                );
              }}
            >
              <Map size={16} color={colors.brand.blue.deep} strokeWidth={2} />
              <Text style={styles.actionBtnText}>Mapa</Text>
            </Pressable>
          </View>
        </View>

        {visits.length > 0 && (
          <>
            <SectionLabel>PRÉSTAMOS ACTIVOS</SectionLabel>
            {visits.map((v) => {
              const progress = v.termLength > 0 ? (v.installmentNumber - 1) / v.termLength : 0;
              return (
                <Pressable
                  key={v.loanId}
                  style={styles.loanCard}
                  onPress={() => router.push(`/prestamo/${v.loanId}`)}
                >
                  <View style={styles.loanHeader}>
                    <View style={styles.loanHeaderLeft}>
                      <Text style={styles.loanTitle}>
                        {v.loanNickname
                          ? `${v.loanNickname} · #${v.loanId}`
                          : `Préstamo #${v.loanId}`}
                      </Text>
                      <Text style={styles.loanSub}>{formatRD(v.paymentAmount)} por cuota</Text>
                    </View>
                    <ChevronRight size={18} color={colors.text.secondary} strokeWidth={2} />
                  </View>
                  <ProgressBar progress={progress} />
                  <View style={styles.loanMeta}>
                    <Text style={styles.loanMetaLeft}>
                      Cuota {v.installmentNumber - 1} de {v.termLength}
                    </Text>
                    <Text
                      style={[
                        styles.loanMetaRight,
                        v.isOverdue && { color: colors.brand.orange.deep }
                      ]}
                    >
                      {v.isOverdue ? `${v.daysOverdue}d atraso` : `${formatRD(v.paymentAmount)}`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}

        {recentPayments.length > 0 && (
          <>
            <SectionLabel>PAGOS RECIENTES</SectionLabel>
            <View style={styles.visitList}>
              {recentPayments.map((p) => (
                <View key={p.id} style={styles.visitRow}>
                  <View style={styles.visitDot}>
                    <Check size={14} color={colors.brand.blue.primary} strokeWidth={2} />
                  </View>
                  <View style={styles.visitTextWrap}>
                    <Text style={styles.visitTitle}>Pago · {formatRD(Number(p.amount))}</Text>
                    <Text style={styles.visitDate}>{formatPaymentDate(p.paidAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  profileCard: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    gap: 14
  },
  profileName: { fontFamily: "Geist_700Bold", fontSize: 20, color: colors.brand.blue.deep },
  profileLegal: {
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: -8
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand.mist,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.blue.deep },
  infoRows: { gap: 8, width: "100%" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontFamily: "Geist_500Medium", fontSize: 14, color: colors.brand.ink },
  actionRow: { flexDirection: "row", gap: 10, width: "100%" },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brand.mist,
    borderRadius: 10,
    padding: 10
  },
  actionBtnText: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.blue.deep },
  loanCard: {
    backgroundColor: colors.brand.white,
    borderRadius: radii.card,
    padding: 16,
    gap: 12
  },
  loanHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  loanHeaderLeft: { flex: 1, gap: 2 },
  loanTitle: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.ink },
  loanSub: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.text.secondary },
  loanMeta: { flexDirection: "row", justifyContent: "space-between" },
  loanMetaLeft: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.ink },
  loanMetaRight: { fontFamily: "Geist_700Bold", fontSize: 12, color: colors.brand.blue.deep },
  visitList: { gap: 8 },
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brand.white,
    borderRadius: 10,
    padding: 10
  },
  visitDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  visitTextWrap: { flex: 1 },
  visitTitle: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.ink },
  visitDate: { fontFamily: "Geist_500Medium", fontSize: 11, color: colors.text.secondary }
});
