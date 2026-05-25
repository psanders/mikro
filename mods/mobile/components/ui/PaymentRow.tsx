/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "../../lib/theme";

interface PaymentRowProps {
  day: string;
  month: string;
  title: string;
  subtitle: string;
  amount: string;
  note?: string;
}

export function PaymentRow({ day, month, title, subtitle, amount, note }: PaymentRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.dateBox}>
        <Text style={styles.day}>{day}</Text>
        <Text style={styles.month}>{month}</Text>
      </View>
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.trail}>
        <Text style={styles.amount}>{amount}</Text>
        {note && <Text style={styles.note}>{note}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.brand.white,
    borderRadius: radii.card,
    padding: 14
  },
  dateBox: {
    width: 44,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.brand.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  day: { fontFamily: "Geist_700Bold", fontSize: 16, color: colors.brand.blue.deep },
  month: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.brand.blue.deep
  },
  mid: { flex: 1, gap: 4 },
  title: { fontFamily: "Geist_700Bold", fontSize: 13, color: colors.brand.ink },
  subtitle: {
    fontFamily: "Geist_500Medium",
    fontSize: 11,
    lineHeight: 15,
    color: colors.text.secondary
  },
  trail: { alignItems: "flex-end", gap: 2 },
  amount: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.ink },
  note: { fontFamily: "Geist_500Medium", fontSize: 10, color: colors.text.secondary }
});
