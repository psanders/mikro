/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";

interface ProgressBarProps {
  progress: number;
  color?: string;
}

export function ProgressBar({ progress, color = colors.brand.blue.primary }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.mist,
    width: "100%",
    overflow: "hidden"
  },
  fill: { height: 8, borderRadius: 4 }
});
