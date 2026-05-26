/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Offline receipt rendered as a React Native view (capturable via react-native-view-shot).
 * Mirrors the server-side receipt layout but uses "SIN FIRMA DIGITAL" instead of a QR code.
 */
import { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";

export interface ReceiptViewData {
  loanNumber: string;
  name: string;
  date: string;
  amountPaid: string;
  pendingPayments: number;
  paymentNumber: string;
  agentName?: string;
  feePaid?: string;
  totalPaid?: string;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

export const ReceiptView = forwardRef<View, { data: ReceiptViewData }>(({ data }, ref) => {
  const fields: [string, string][] = [
    ["Préstamo", `#${data.loanNumber}`],
    ["Cliente", data.name],
    ["Fecha", data.date]
  ];
  fields.push(["Monto Pagado", data.amountPaid]);
  if (data.feePaid) {
    fields.push(["Mora Pagada", data.feePaid]);
    if (data.totalPaid) fields.push(["Total Pagado", data.totalPaid]);
  }
  fields.push(
    ["Pagos Pendientes", String(data.pendingPayments)],
    ["No. de Pago", data.paymentNumber]
  );
  if (data.agentName) fields.push(["Cobrador", data.agentName]);

  return (
    <View ref={ref} collapsable={false} style={s.receipt}>
      <View style={s.header}>
        <Text style={s.brand}>mikro</Text>
        <Text style={s.subtitle}>RECIBO DE PAGO</Text>
      </View>

      <View style={s.dashedDivider} />

      <View style={s.amountSection}>
        <Text style={s.amount}>{data.totalPaid ?? data.amountPaid}</Text>
      </View>

      <View style={s.divider} />

      <View style={s.fields}>
        {fields.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </View>

      <View style={s.dashedDivider} />

      <View style={s.placeholderContainer}>
        <View style={s.placeholder}>
          <Text style={s.placeholderText}>SIN</Text>
          <Text style={s.placeholderText}>FIRMA</Text>
          <Text style={s.placeholderText}>DIGITAL</Text>
        </View>
      </View>

      <View style={s.footer}>
        <Text style={s.thanks}>Gracias por su pago</Text>
        <Text style={s.website}>www.mikro.do</Text>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  receipt: {
    width: 384,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20
  },
  header: {
    alignItems: "center",
    gap: 4,
    paddingTop: 20,
    paddingBottom: 8
  },
  brand: {
    fontFamily: "Geist_700Bold",
    fontSize: 28,
    color: "#103A8A",
    letterSpacing: -0.5
  },
  subtitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
    color: "#5B6472",
    letterSpacing: 2
  },
  dashedDivider: {
    width: "100%",
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: "#C0C8D4"
  },
  amountSection: {
    alignItems: "center",
    paddingVertical: 16
  },
  amount: {
    fontFamily: "Geist_700Bold",
    fontSize: 32,
    color: "#103A8A"
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#E0E6EF"
  },
  fields: {
    gap: 10,
    paddingVertical: 14
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%"
  },
  rowLabel: {
    fontFamily: "Geist_400Regular",
    fontSize: 13,
    color: "#5B6472"
  },
  rowValue: {
    fontFamily: "Geist_700Bold",
    fontSize: 13,
    color: "#14254A"
  },
  placeholderContainer: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 4
  },
  placeholder: {
    width: 120,
    height: 120,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#C0C8D4",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  placeholderText: {
    fontFamily: "Geist_700Bold",
    fontSize: 16,
    color: "#8896AB"
  },
  footer: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 20,
    gap: 2
  },
  thanks: {
    fontFamily: "Geist_700Bold",
    fontSize: 11,
    color: "#14254A"
  },
  website: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 10,
    color: "#103A8A"
  }
});
