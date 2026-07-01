/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";

interface BreakdownBarProps {
  label: string;
  value: string;
  progress: number;
  color?: string;
}

export function BreakdownBar({
  label,
  value,
  progress,
  color = colors.brand.blue.primary
}: BreakdownBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, width: "100%" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontFamily: "Geist_500Medium", fontSize: 12, color: "#697A93" },
  value: { fontFamily: "Geist_700Bold", fontSize: 12, color: colors.brand.ink },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#EEF3F9",
    width: "100%",
    overflow: "hidden"
  },
  fill: { height: 6, borderRadius: 999 }
});
