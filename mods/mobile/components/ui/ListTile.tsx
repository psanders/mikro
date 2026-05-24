/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, Text, StyleSheet } from "react-native";
import { ChevronRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";

interface ListTileProps {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
}

export function ListTile({ icon: Icon, label, onPress }: ListTileProps) {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <Icon size={18} color={colors.text.secondary} strokeWidth={2} />
      <Text style={styles.label}>{label}</Text>
      <ChevronRight size={18} color={colors.text.secondary} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.brand.white,
    borderRadius: radii.sm + 4,
    padding: 12
  },
  label: { flex: 1, fontFamily: "Geist_500Medium", fontSize: 14, color: colors.brand.ink }
});
