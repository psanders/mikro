/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, View, Text, StyleSheet } from "react-native";
import { colors, radii } from "../../lib/theme";

type ChipVariant = "default" | "warning" | "danger";

interface ChipProps {
  label: string;
  active?: boolean;
  variant?: ChipVariant;
  onPress?: () => void;
}

export function Chip({ label, active, variant = "default", onPress }: ChipProps) {
  if (active) {
    return (
      <Pressable onPress={onPress} style={[styles.container, styles.active]}>
        <Text style={[styles.text, styles.activeText]}>{label}</Text>
      </Pressable>
    );
  }

  if (variant === "danger") {
    return (
      <Pressable onPress={onPress} style={[styles.container, styles.danger]}>
        <View style={styles.dot} />
        <Text style={[styles.text, styles.dangerText]}>{label}</Text>
      </Pressable>
    );
  }

  const textColor = variant === "warning" ? colors.brand.orange.deep : colors.brand.ink;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.brand.white,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D3DFF4"
  },
  active: { backgroundColor: colors.brand.blue.deep, borderColor: colors.brand.blue.deep },
  danger: { borderColor: "#F2C2A4" },
  text: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.brand.ink },
  activeText: { color: colors.brand.white, fontFamily: "Geist_600SemiBold" },
  dangerText: { color: colors.brand.orange.deep, fontFamily: "Geist_600SemiBold" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand.orange.deep }
});
