/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, StyleSheet } from "react-native";
import { Check, Clock, AlertCircle } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";

type CuotaStatus = "paid" | "pending" | "overdue";

interface CuotaRowProps {
  name: string;
  date: string;
  amount: string;
  status: CuotaStatus;
}

const STATUS_CONFIG = {
  paid: { bg: colors.brand.blue.primary, icon: Check, amountColor: colors.brand.blue.primary },
  pending: { bg: colors.text.secondary, icon: Clock, amountColor: colors.brand.ink },
  overdue: { bg: colors.status.danger, icon: AlertCircle, amountColor: colors.status.danger }
} as const;

export function CuotaRow({ name, date, amount, status }: CuotaRowProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <View style={styles.container}>
      <View style={[styles.mark, { backgroundColor: config.bg }]}>
        <Icon size={14} color={colors.brand.white} strokeWidth={2} />
      </View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.date}>{date}</Text>
      <Text style={[styles.amount, { color: config.amountColor }]}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.brand.white,
    borderRadius: radii.sm + 2,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.ink, width: 80 },
  date: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.text.secondary, flex: 1 },
  amount: { fontFamily: "Geist_700Bold", fontSize: 13 }
});
