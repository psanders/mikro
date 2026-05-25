/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "../../lib/theme";

interface BadgeProps {
  children: string;
  variant?: "default" | "success" | "warning" | "danger";
}

const VARIANT_STYLES = {
  default: { bg: colors.brand.mist, text: colors.brand.blue.deep },
  success: { bg: colors.status.successBg, text: colors.status.success },
  warning: { bg: colors.status.warningBg, text: colors.status.warning },
  danger: { bg: colors.status.dangerBg, text: colors.status.danger }
} as const;

export function Badge({ children, variant = "default" }: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <View style={[styles.container, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radii.pill, paddingVertical: 4, paddingHorizontal: 10 },
  text: { fontFamily: "Geist_700Bold", fontSize: 11 }
});
