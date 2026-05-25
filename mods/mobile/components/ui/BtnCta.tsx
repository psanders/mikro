/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, Text, StyleSheet } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";

interface BtnCtaProps {
  label: string;
  onPress?: () => void;
  icon?: LucideIcon;
  color?: string;
  disabled?: boolean;
}

export function BtnCta({
  label,
  onPress,
  icon: Icon,
  color = colors.brand.blue.deep,
  disabled
}: BtnCtaProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.container, { backgroundColor: color, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={styles.label}>{label}</Text>
      {Icon && <Icon size={18} color={colors.brand.white} strokeWidth={2} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: radii.card,
    padding: 18,
    width: "100%"
  },
  label: { fontFamily: "Geist_700Bold", fontSize: 17, color: colors.brand.white }
});
