/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, StyleSheet } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";

interface IconButtonProps {
  icon: LucideIcon;
  onPress?: () => void;
  size?: number;
  iconColor?: string;
}

export function IconButton({
  icon: Icon,
  onPress,
  size = 36,
  iconColor = colors.brand.blue.deep
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Icon size={20} color={iconColor} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.brand.mist,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill
  }
});
