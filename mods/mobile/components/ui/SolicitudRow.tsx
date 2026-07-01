/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, View, Text, StyleSheet } from "react-native";
import { Avatar } from "./Avatar";
import { colors, radii } from "../../lib/theme";

type RiskVariant = "low" | "medium" | "high";

interface SolicitudRowProps {
  name: string;
  business: string;
  meta: string;
  riskLabel: string;
  riskVariant?: RiskVariant;
  score: number;
  imageUri?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  testID?: string;
}

const RISK_STYLES: Record<RiskVariant, { bg: string; text: string }> = {
  low: { bg: colors.status.successBg, text: colors.status.success },
  medium: { bg: colors.status.warningBg, text: colors.status.warning },
  high: { bg: colors.status.dangerBg, text: colors.status.danger }
};

export function SolicitudRow({
  name,
  business,
  meta,
  riskLabel,
  riskVariant = "low",
  score,
  imageUri,
  onPress,
  onLongPress,
  testID
}: SolicitudRowProps) {
  const risk = RISK_STYLES[riskVariant];

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} testID={testID} style={styles.container}>
      <Avatar name={name} imageUri={imageUri} />
      <View style={styles.mid}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.biz} numberOfLines={1}>
          {business}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={styles.trail}>
        <View style={[styles.pill, { backgroundColor: risk.bg }]}>
          <Text style={[styles.pillText, { color: risk.text }]}>{riskLabel}</Text>
        </View>
        <Text style={styles.score}>{`Score ${score}`}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.card,
    backgroundColor: colors.brand.white,
    padding: 14
  },
  mid: { flex: 1, gap: 2 },
  name: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.ink },
  biz: { fontFamily: "Geist_700Bold", fontSize: 11, color: colors.brand.blue.deep },
  meta: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.text.secondary },
  trail: { alignItems: "flex-end", gap: 6 },
  pill: { borderRadius: radii.pill, paddingVertical: 4, paddingHorizontal: 10 },
  pillText: { fontFamily: "Geist_700Bold", fontSize: 10 },
  score: { fontFamily: "Geist_600SemiBold", fontSize: 11, color: colors.text.secondary }
});
