/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, StyleSheet } from "react-native";
import { Avatar } from "./Avatar";
import { colors } from "../../lib/theme";

type RiskVariant = "low" | "medium" | "high";

interface ScoreSummaryProps {
  name: string;
  business: string;
  riskLabel: string;
  riskVariant?: RiskVariant;
  score: number;
  imageUri?: string;
}

const RISK_STYLES: Record<RiskVariant, { bg: string; text: string; bar: string }> = {
  low: { bg: "#E8F7EE", text: "#16A34A", bar: "#16A34A" },
  medium: { bg: colors.status.warningBg, text: colors.status.warning, bar: colors.status.warning },
  high: { bg: colors.status.dangerBg, text: colors.status.danger, bar: colors.status.danger }
};

export function ScoreSummary({
  name,
  business,
  riskLabel,
  riskVariant = "low",
  score,
  imageUri
}: ScoreSummaryProps) {
  const risk = RISK_STYLES[riskVariant];
  const pct = Math.max(0, Math.min(100, score));

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Avatar name={name} imageUri={imageUri} size={44} />
        <View style={styles.mid}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.biz} numberOfLines={1}>
            {business}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: risk.bg }]}>
          <Text style={[styles.pillText, { color: risk.text }]}>{riskLabel}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.num}>{score}</Text>
        <Text style={styles.den}>/ 100 · Mikro Score</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: risk.bar }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.brand.white,
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border.card
  },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  mid: { flex: 1, gap: 2 },
  name: { fontFamily: "Geist_700Bold", fontSize: 16, color: colors.brand.ink },
  biz: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.blue.deep },
  pill: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 },
  pillText: { fontFamily: "Geist_700Bold", fontSize: 11 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  num: { fontFamily: "Geist_700Bold", fontSize: 36, letterSpacing: -1, color: colors.brand.ink },
  den: { fontFamily: "Geist_500Medium", fontSize: 13, color: "#697A93" },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#EEF3F9",
    width: "100%",
    overflow: "hidden"
  },
  fill: { height: 6, borderRadius: 999 }
});
