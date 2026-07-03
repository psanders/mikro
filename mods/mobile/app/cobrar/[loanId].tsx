/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
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
import {
  useLocalLoan,
  useLocalLateFeePreview,
  useLocalLoanVisit,
  useLocalCollector
} from "../../lib/offline/hooks";
import { useSyncContext } from "../../lib/offline/SyncProvider";
import { queuePayment } from "../../lib/offline/mutations";
import { getLastCustomerPaymentAt } from "../../lib/offline/queries";
import { computePaymentSplit } from "@mikro/common/utils/paymentSplit";
import { getRoles, canManagePayments } from "../../lib/auth";

// Collectors are blocked from charging the same customer twice within this
// window to prevent duplicate payments. Mirrors the server-side guard.
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO")}`;
}

type PayOption = "cuota" | "arrears" | "mora" | "settle" | "custom";

export default function CobrarPagoScreen() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const numericId = Number(loanId);
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<PayOption | null>(null);
  const [payMethod, setPayMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [customAmountText, setCustomAmountText] = useState("");
  const customInputRef = useRef<TextInput>(null);

  // REVIEWER-only accounts must not reach the collection flow, even via a
  // direct deep link with the Cobrar CTA hidden elsewhere (mikro/#73).
  // Defaults to blocked until roles resolve.
  const [canPay, setCanPay] = useState(false);
  useEffect(() => {
    getRoles().then((roles) => setCanPay(canManagePayments(roles)));
  }, []);

  const loanQuery = useLocalLoan(numericId);
  const lateFeeQuery = useLocalLateFeePreview(numericId);
  const visitQuery = useLocalLoanVisit(numericId);
  const collectorQuery = useLocalCollector();
  const { isOnline, refreshState, pull } = useSyncContext();

  const createPayment = trpc.createPayment.useMutation();

  const loan = loanQuery.data;
  const lateFee = lateFeeQuery.data;
  const collectorId = collectorQuery.data?.id;

  const visit = visitQuery.data;

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
    if (mora === 0) {
      opts.push({ key: "cuota", label: "Cobrar cuota", value: formatRD(cuota) });
    }
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
    opts.push({ key: "custom", label: "Otro monto", value: "" });
    return opts;
  }, [cuota, mora, remainingCuotas, settleAmount]);

  const effectiveOption = selectedOption ?? (mora > 0 ? "arrears" : "cuota");

  const customAmount = useMemo(() => {
    const n = Number(customAmountText.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [customAmountText]);

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
      case "custom":
        return customAmount;
    }
  }, [effectiveOption, cuota, mora, settleAmount, customAmount]);

  const split = useMemo(
    () =>
      computePaymentSplit({
        amount: amount ?? 0,
        expectedCuota: cuota,
        accruedMora: effectiveOption === "mora" ? 0 : mora,
        kind: effectiveOption === "mora" ? "LATE_FEE" : undefined
      }),
    [amount, cuota, mora, effectiveOption]
  );

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
    } else if (effectiveOption === "custom") {
      if (mora > 0 && customAmount > 0) {
        rows.push({ label: "Cargo por mora", value: formatRD(split.lateFeePortion) });
        if (split.installmentPortion > 0) {
          rows.push({ label: "Aplica a cuota", value: formatRD(split.installmentPortion) });
        }
      } else {
        rows.push({
          label: "Monto personalizado",
          value: customAmount > 0 ? formatRD(customAmount) : "—"
        });
      }
    } else {
      rows.push({ label: `Cuota ${paidCount + 1}`, value: formatRD(cuota) });
    }
    return rows;
  }, [effectiveOption, mora, cuota, paidCount, remainingCuotas, customAmount, split]);

  const hintText = payOptions.find((o) => o.key === effectiveOption)?.label ?? "";

  const handleConfirm = async () => {
    if (!collectorId || submitting || amount <= 0) return;

    // Guard against duplicate collections for the same customer within the
    // window (handles double-taps, re-entries, and most sync retries before
    // they ever reach the server).
    const customerId = loan?.customerId ?? visit?.customerId;
    if (customerId) {
      const lastPaidAt = getLastCustomerPaymentAt(customerId);
      if (lastPaidAt) {
        const elapsed = Date.now() - new Date(lastPaidAt).getTime();
        if (elapsed >= 0 && elapsed < DEDUP_WINDOW_MS) {
          const mins = Math.max(1, Math.ceil((DEDUP_WINDOW_MS - elapsed) / 60000));
          Alert.alert(
            "Cobro reciente",
            `Ya registraste un cobro para este cliente hace poco. Espera ${mins} min antes de cobrar de nuevo para evitar duplicados.`
          );
          return;
        }
      }
    }

    setSubmitting(true);
    const methodLabel = payMethod === "CASH" ? "Efectivo" : "Transferencia";
    const paymentInput = {
      loanId: numericId,
      amount,
      method: payMethod,
      collectedById: collectorId,
      ...(effectiveOption === "mora" ? { kind: "LATE_FEE" as const } : { cuota, mora })
    };

    try {
      if (isOnline) {
        await createPayment.mutateAsync(paymentInput);
        refreshState();
        // The payment lives only on the server now; pull it into the local DB so
        // Cuadre, Plan de pagos and the home "META DE HOY" reflect it instead of
        // waiting for a stale sync.
        void pull();
      } else {
        queuePayment(paymentInput);
        refreshState();
      }

      router.replace({
        pathname: "/pago-confirmado",
        params: {
          customerName: displayName,
          amount: String(amount),
          mora: String(effectiveOption === "cuota" ? 0 : mora),
          cuota: String(effectiveOption === "custom" && mora === 0 ? 0 : cuota),
          method: methodLabel,
          loanId: String(loanId),
          paymentNumber: String(effectiveOption === "mora" ? 0 : paidCount + 1),
          pendingPayments: String(
            effectiveOption === "settle"
              ? 0
              : effectiveOption === "mora" || split.installmentStatus === "PARTIAL"
                ? remainingCuotas
                : Math.max(0, remainingCuotas - 1)
          ),
          collectorName: collectorQuery.data?.name ?? ""
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      if (message.includes("DUPLICATE_PAYMENT")) {
        Alert.alert(
          "Cobro duplicado",
          "Ya existe un cobro reciente para este cliente. No se registró un cobro duplicado."
        );
      } else {
        Alert.alert("Error", `No se pudo registrar el cobro: ${message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!canPay) {
    return (
      <View style={styles.screen}>
        <Header title="Registrar cobro" backMode="close" />
        <Text style={styles.forbiddenText}>
          Tu rol de Evaluador no incluye cobrar pagos. Contacta a un cobrador o administrador.
        </Text>
      </View>
    );
  }

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
              onPress={() => {
                setSelectedOption(o.key);
                if (o.key === "custom") {
                  setTimeout(() => customInputRef.current?.focus(), 100);
                }
              }}
            />
          ))}
          {effectiveOption === "custom" && (
            <View style={styles.customInputCard}>
              <Text style={styles.customInputLabel}>RD$</Text>
              <TextInput
                ref={customInputRef}
                style={styles.customInput}
                value={customAmountText}
                onChangeText={setCustomAmountText}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.text.secondary}
              />
            </View>
          )}
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
  forbiddenText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    paddingVertical: 40,
    paddingHorizontal: 20
  },
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
  customInputCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.white,
    borderRadius: radii.sm + 4,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.brand.blue.primary
  },
  customInputLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 18,
    color: colors.brand.blue.primary
  },
  customInput: {
    flex: 1,
    fontFamily: "Geist_700Bold",
    fontSize: 24,
    color: colors.brand.blue.deep,
    padding: 0
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
