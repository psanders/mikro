/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, View, Text, StyleSheet } from "react-native";
import { CreditCard, X } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors } from "../../lib/theme";

interface DocRowProps {
  label: string;
  icon?: LucideIcon;
  actionLabel?: string;
  uploaded?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  testID?: string;
  actionTestID?: string;
  removeTestID?: string;
}

export function DocRow({
  label,
  icon: Icon = CreditCard,
  actionLabel = "Subir",
  uploaded,
  onPress,
  onRemove,
  testID,
  actionTestID,
  removeTestID
}: DocRowProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Icon size={18} color="#697A93" strokeWidth={2} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Pressable onPress={onPress} hitSlop={8} testID={actionTestID}>
        <Text style={styles.action}>{actionLabel}</Text>
      </Pressable>
      {uploaded && (
        <Pressable onPress={onRemove} hitSlop={8} testID={removeTestID}>
          <X size={14} color="#697A93" strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 10,
    backgroundColor: "#EEF3F9",
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  label: { flex: 1, fontFamily: "Geist_500Medium", fontSize: 13, color: colors.brand.ink },
  action: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.blue.primary }
});
