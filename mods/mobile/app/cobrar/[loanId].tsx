/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Banknote, ArrowRightLeft, Check } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { ClientRow } from "../../components/ui/ClientRow";
import { OptionRow } from "../../components/ui/OptionRow";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { KvRow } from "../../components/ui/KvRow";
import { trpc } from "../../lib/api";
import { useLocalLoan, useLocalLateFeePreview, useLocalDashboard } from "../../lib/offline/hooks";
import { useSyncContext } from "../../lib/offline/SyncProvider";
import { queuePayment } from "../../lib/offline/mutations";

function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO")}`;
}

type PayOption = "cuota" | "arrears" | "mora" | "settle";

export default function CobrarPagoScreen() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const numericId = Number(loanId);
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<PayOption | null>(null);
  const [payMethod, setPayMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [submitting, setSubmitting] = useState(false);

  const loanQuery = useLocalLoan(numericId);
  const lateFeeQuery = useLocalLateFeePreview(numericId);
  const dashboard = useLocalDashboard();
  const { isOnline, refreshState } = useSyncContext();

  const createPayment = trpc.createPayment.useMutation();

  const loan = loanQuery.data;
  const lateFee = lateFeeQuery.data;
  const collectorId = dashboard.data?.collector.id;

  const visit = useMemo(() => {
    return (dashboard.data?.visits ?? []).find((v) => v.loanId === numericId);
  }, [dashboard.data?.visits, numericId]);

  const cuota = lateFee?.cuota ?? (loan ? Number(loan.paymentAmount) : 0);
  const mora = lateFee?.accruedMora ?? 0;
  const termLength = loan?.termLength ?? visit?.termLength ?? 0;
  const paidCount = visit ? visit.installmentNumber - 1 : 0;
  const remainingCuotas = Math.max(0, termLength - paidCount);
  const settleAmount = remainingCuotas * cuota + mora;

  const displayName =
    loan?.customer?.nickname ??
    loan?.customer?.name ??
    visit?.loanNickname ??
    visit?.customerName ??
    "...";
  const meta = `Préstamo #${loanId}`;

  const payOptions = useMemo(() => {
    const opts: { key: PayOption; label: string; value: string }[] = [];
    if (mora > 0) {
      opts.push({
        key: "arrears",
        label: "Cobrar cuota + mora",
        value: formatRD(cuota + mora)
      });
    }
    opts.push({ key: "cuota", label: "Cobrar cuota", value: formatRD(cuota) });
    if (mora > 0) {
      opts.push({ key: "mora", label: "Solo mora", value: formatRD(mora) });
    }
    if (remainingCuotas > 1) {
      opts.push({
        key: "settle",
        label: "Saldar préstamo",
        value: formatRD(settleAmount)
      });
    }
    return opts;
  }, [cuota, mora, remainingCuotas, settleAmount]);

  const effectiveOption = selectedOption ?? (mora > 0 ? "arrears" : "cuota");

  const amount = useMemo(() => {
    switch (effectiveOption) {
      case "cuota":
        return cuota;
      case "arrears":
        return cuota + mora;
      case "mora":
        return mora;
      case "settle":
        return settleAmount;
    }
  }, [effectiveOption, cuota, mora, settleAmount]);

  const breakdownRows = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (effectiveOption === "mora") {
      rows.push({ label: "Cargo por mora", value: formatRD(mora) });
    } else if (effectiveOption === "arrears" && mora > 0) {
      rows.push({ label: "Cargo por mora", value: formatRD(mora) });
      rows.push({ label: `Cuota ${paidCount + 1}`, value: formatRD(cuota) });
    } else if (effectiveOption === "settle") {
      if (mora > 0) rows.push({ label: "Cargo por mora", value: formatRD(mora) });
      rows.push({
        label: `${remainingCuotas} cuotas restantes`,
        value: formatRD(remainingCuotas * cuota)
      });
    } else {
      rows.push({ label: `Cuota ${paidCount + 1}`, value: formatRD(cuota) });
    }
    return rows;
  }, [effectiveOption, mora, cuota, paidCount, remainingCuotas]);

  const hintText = payOptions.find((o) => o.key === effectiveOption)?.label ?? "";

  const handleConfirm = async () => {
    if (!collectorId || submitting || amount <= 0) return;

    setSubmitting(true);
    const methodLabel = payMethod === "CASH" ? "Efectivo" : "Transferencia";
    const paymentInput = {
      loanId: numericId,
      amount,
      method: payMethod,
      collectedById: collectorId,
      ...(effectiveOption === "mora" ? { kind: "LATE_FEE" as const } : {})
    };

    try {
      if (isOnline) {
        await createPayment.mutateAsync(paymentInput);
      } else {
        queuePayment(paymentInput);
      }
      refreshState();

      router.replace({
        pathname: "/pago-confirmado",
        params: {
          customerName: displayName,
          amount: String(amount),
          mora: String(
            effectiveOption === "arrears" ||
              effectiveOption === "settle" ||
              effectiveOption === "mora"
              ? mora
              : 0
          ),
          cuota: String(cuota),
          method: methodLabel,
          loanId: String(loanId),
          paymentNumber: String(effectiveOption === "mora" ? 0 : paidCount + 1),
          pendingPayments: String(
            effectiveOption === "settle" ? 0 : Math.max(0, remainingCuotas - 1)
          ),
          collectorName: dashboard.data?.collector.name ?? ""
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      Alert.alert("Error", `No se pudo registrar el cobro: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Header title="Registrar cobro" backMode="close" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ClientRow name={displayName} business="" meta={meta} amount="" />

        <View style={styles.amountCard}>
          <SectionLabel>MONTO A COBRAR</SectionLabel>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>RD$</Text>
            <Text style={styles.amountNumber}>{amount.toLocaleString("es-DO")}</Text>
          </View>
          <Text style={styles.amountHint}>{hintText}</Text>
        </View>

        <View style={styles.optionsSection}>
          <SectionLabel>TIPO DE COBRO</SectionLabel>
          {payOptions.map((o) => (
            <OptionRow
              key={o.key}
              label={o.label}
              value={o.value}
              selected={effectiveOption === o.key}
              onPress={() => setSelectedOption(o.key)}
            />
          ))}
        </View>

        <View style={styles.breakdownCard}>
          <SectionLabel>CÓMO SE APLICA</SectionLabel>
          {breakdownRows.map((r) => (
            <KvRow key={r.label} label={r.label} value={r.value} />
          ))}
        </View>

        <View style={styles.methodSection}>
          <SectionLabel>MÉTODO DE PAGO</SectionLabel>
          <View style={styles.methodRow}>
            <Pressable
              style={[styles.methodBtn, payMethod === "CASH" && styles.methodBtnActive]}
              onPress={() => setPayMethod("CASH")}
            >
              <Banknote
                size={18}
                color={payMethod === "CASH" ? colors.brand.white : colors.brand.blue.deep}
                strokeWidth={2}
              />
              <Text style={[styles.methodText, payMethod === "CASH" && styles.methodTextActive]}>
                Efectivo
              </Text>
            </Pressable>
            <Pressable
              style={[styles.methodBtn, payMethod === "TRANSFER" && styles.methodBtnActive]}
              onPress={() => setPayMethod("TRANSFER")}
            >
              <ArrowRightLeft
                size={18}
                color={payMethod === "TRANSFER" ? colors.brand.white : colors.brand.blue.deep}
                strokeWidth={2}
              />
              <Text
                style={[styles.methodText, payMethod === "TRANSFER" && styles.methodTextActive]}
              >
                Transferencia
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Pressable
        style={[styles.ctaBtn, submitting && { opacity: 0.6 }]}
        onPress={handleConfirm}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.brand.white} />
        ) : (
          <Check size={20} color={colors.brand.white} strokeWidth={2} />
        )}
        <Text style={styles.ctaText}>{submitting ? "Procesando..." : "Confirmar y cobrar"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 18 },
  amountCard: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 20,
    paddingVertical: 24,
    alignItems: "center",
    gap: 8
  },
  amountRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  amountCurrency: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 22,
    color: colors.brand.blue.primary
  },
  amountNumber: {
    fontFamily: "Geist_700Bold",
    fontSize: 54,
    color: colors.brand.blue.deep,
    letterSpacing: -2,
    lineHeight: 54
  },
  amountHint: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.orange.deep },
  optionsSection: { gap: 8 },
  breakdownCard: {
    backgroundColor: colors.brand.white,
    borderRadius: radii.card,
    padding: 14,
    gap: 10
  },
  methodSection: { gap: 8 },
  methodRow: { flexDirection: "row", gap: 8 },
  methodBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D3DFF4"
  },
  methodBtnActive: { backgroundColor: colors.brand.blue.deep, borderColor: colors.brand.blue.deep },
  methodText: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.blue.deep },
  methodTextActive: { color: colors.brand.white },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.brand.blue.deep,
    padding: 18,
    marginHorizontal: 0
  },
  ctaText: { fontFamily: "Geist_700Bold", fontSize: 15, color: colors.brand.white }
});
