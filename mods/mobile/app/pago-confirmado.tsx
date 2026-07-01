/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState, useRef, useMemo } from "react";
import { computePaymentSplit } from "@mikro/common/utils/paymentSplit";
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
import { Check, MessageCircle, Printer } from "lucide-react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { captureRef } from "react-native-view-shot";
import { colors } from "../lib/theme";
import { KvRow } from "../components/ui/KvRow";
import { printReceiptWithUI } from "../lib/printer";
import { api } from "../lib/trpc";
import { useSyncContext } from "../lib/offline/SyncProvider";
import { ReceiptView, type ReceiptViewData } from "../components/ReceiptView";

function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO")}`;
}

function formatReceiptRD(amount: number): string {
  return `RD$ ${amount.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNow(): string {
  const now = new Date();
  const day = now.getDate();
  const months = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic"
  ];
  const month = months[now.getMonth()];
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${day} ${month}, ${h % 12 || 12}:${m} ${ampm}`;
}

export default function PagoConfirmadoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    customerName?: string;
    amount?: string;
    mora?: string;
    cuota?: string;
    method?: string;
    loanId?: string;
    paymentNumber?: string;
    pendingPayments?: string;
    collectorName?: string;
  }>();

  const { isOnline } = useSyncContext();
  const [printing, setPrinting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const receiptRef = useRef<View>(null);

  const amount = Number(params.amount) || 0;
  const mora = Number(params.mora) || 0;
  const cuota = Number(params.cuota) || 0;
  const customerName = params.customerName ?? "Cliente";
  const method = params.method ?? "Efectivo";
  const loanId = params.loanId ?? "";
  const paymentNumber = Number(params.paymentNumber) || 0;
  const pendingPayments = Number(params.pendingPayments) || 0;
  const collectorName = params.collectorName ?? "";

  const receiptDate = useMemo(() => {
    return new Date().toLocaleDateString("es-DO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }, []);

  const isMoraOnly = paymentNumber === 0;
  const split = computePaymentSplit({
    amount,
    expectedCuota: cuota,
    accruedMora: mora,
    kind: isMoraOnly ? "LATE_FEE" : undefined
  });
  const isPartial = !isMoraOnly && split.installmentStatus === "PARTIAL";

  const paymentLabel = isMoraOnly
    ? "Mora"
    : isPartial
      ? `Parcial P${paymentNumber}`
      : `P${paymentNumber}`;

  const receiptViewData = useMemo<ReceiptViewData>(
    () => ({
      loanNumber: loanId,
      name: customerName,
      date: receiptDate,
      paymentNumber: paymentLabel,
      method,
      amountPaid: isMoraOnly ? undefined : formatReceiptRD(cuota),
      feePaid: mora > 0 ? formatReceiptRD(mora) : undefined,
      totalPaid: formatReceiptRD(amount),
      pendingPayments,
      agentName: collectorName || undefined
    }),
    [
      loanId,
      customerName,
      receiptDate,
      paymentLabel,
      method,
      mora,
      cuota,
      amount,
      pendingPayments,
      collectorName
    ]
  );

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printReceiptWithUI({
        loanId,
        customerName,
        date: formatNow(),
        cuota: isMoraOnly ? 0 : cuota,
        mora,
        total: amount,
        method,
        installmentNumber: isMoraOnly ? undefined : paymentNumber,
        pendingPayments,
        collectorName: collectorName || undefined,
        isPartial
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.iconCircle}>
          <Check size={48} color={colors.brand.blue.deep} strokeWidth={2} />
        </View>

        <View style={styles.headline}>
          <Text style={styles.h1}>¡Pago registrado!</Text>
          <Text style={styles.h2}>Cobro confirmado a {customerName}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardAmountSection}>
            <Text style={styles.cardLabel}>TOTAL COBRADO</Text>
            <Text style={styles.cardAmount}>{formatRD(amount)}</Text>
          </View>
          <View style={styles.cardDivider} />
          {mora > 0 && <KvRow label="Mora aplicada" value={formatRD(mora)} />}
          {!isMoraOnly && cuota > 0 && <KvRow label="Cuota" value={formatRD(cuota)} />}
          <KvRow label="Método" value={method} />
          {loanId ? <KvRow label="Préstamo" value={`#${loanId}`} /> : null}
          <KvRow label="Hora" value={formatNow()} />
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, sharing && { opacity: 0.6 }]}
            disabled={sharing}
            onPress={async () => {
              setSharing(true);
              try {
                let fileUri: string | undefined;

                // Mora-only receipts have no amountPaid; the API schema
                // requires it, so those always render via local capture.
                if (isOnline && receiptViewData.amountPaid !== undefined) {
                  try {
                    const result = await api.generateReceiptFromData.mutate({
                      ...receiptViewData,
                      amountPaid: receiptViewData.amountPaid
                    });
                    const file = new File(Paths.cache, `recibo-${loanId}.png`);
                    file.write(result.image, { encoding: "base64" });
                    fileUri = file.uri;
                  } catch {
                    // API failed (network gone mid-request) — fall through to local capture
                  }
                }

                if (!fileUri) {
                  fileUri = await captureRef(receiptRef, {
                    format: "png",
                    quality: 1,
                    result: "tmpfile"
                  });
                }

                await Sharing.shareAsync(fileUri, {
                  mimeType: "image/png",
                  dialogTitle: "Enviar recibo"
                });
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                Alert.alert("Error", `No se pudo generar el recibo: ${msg}`);
              } finally {
                setSharing(false);
              }
            }}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={colors.brand.white} />
            ) : (
              <MessageCircle size={18} color={colors.brand.white} strokeWidth={2} />
            )}
            <Text style={styles.actionBtnText}>Enviar recibo</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, printing && { opacity: 0.6 }]}
            onPress={handlePrint}
            disabled={printing}
          >
            {printing ? (
              <ActivityIndicator size="small" color={colors.brand.white} />
            ) : (
              <Printer size={18} color={colors.brand.white} strokeWidth={2} />
            )}
            <Text style={styles.actionBtnText}>Imprimir</Text>
          </Pressable>
        </View>
        <Pressable style={styles.doneBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.doneBtnText}>Listo</Text>
        </Pressable>
      </View>
      {/* Off-screen receipt for offline capture */}
      <View style={styles.offscreen}>
        <ReceiptView ref={receiptRef} data={receiptViewData} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand.blue.deep },
  body: { alignItems: "center", paddingHorizontal: 32, paddingTop: 80, gap: 24, flex: 1 },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brand.yellow.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  headline: { alignItems: "center", gap: 6, width: "100%" },
  h1: { fontFamily: "Geist_700Bold", fontSize: 28, color: colors.brand.white, letterSpacing: -0.5 },
  h2: { fontFamily: "Geist_500Medium", fontSize: 14, color: "#9DB9F0" },
  card: {
    backgroundColor: colors.brand.white,
    borderRadius: 20,
    padding: 24,
    gap: 14,
    width: "100%"
  },
  cardAmountSection: { gap: 4 },
  cardLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.text.secondary
  },
  cardAmount: {
    fontFamily: "Geist_700Bold",
    fontSize: 40,
    color: colors.brand.blue.deep,
    letterSpacing: -1
  },
  cardDivider: { height: 1, backgroundColor: colors.brand.mist },
  actions: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28, gap: 10 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.blue.primary,
    borderRadius: 12,
    padding: 14
  },
  actionBtnText: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.white },
  doneBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 14
  },
  doneBtnText: { fontFamily: "Geist_700Bold", fontSize: 15, color: colors.brand.blue.deep },
  offscreen: { position: "absolute", left: -9999, top: 0 }
});
