/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, Text, StyleSheet } from "react-native";
import { X } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";

interface BtnOutlineProps {
  label: string;
  onPress?: () => void;
  icon?: LucideIcon;
  color?: string;
  disabled?: boolean;
}

export function BtnOutline({
  label,
  onPress,
  icon: Icon = X,
  color = colors.status.danger,
  disabled
}: BtnOutlineProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.container, { borderColor: color, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
      <Icon size={18} color={color} strokeWidth={2} />
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
    backgroundColor: colors.brand.white,
    padding: 18,
    borderWidth: 1.5,
    width: "100%"
  },
  label: { fontFamily: "Geist_700Bold", fontSize: 17 }
});
