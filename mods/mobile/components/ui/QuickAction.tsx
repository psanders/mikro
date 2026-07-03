/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, View, Text, StyleSheet } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";

interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  iconColor?: string;
  onPress?: () => void;
}

export function QuickAction({
  icon: Icon,
  label,
  iconColor = colors.brand.orange.deep,
  onPress
}: QuickActionProps) {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brand.white,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: 6,
    flex: 1
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  label: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.ink }
});
