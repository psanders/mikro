/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, View, Text, StyleSheet } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";

interface SelectFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  onPress?: () => void;
  testID?: string;
}

export function SelectField({ label, value, placeholder, onPress, testID }: SelectFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onPress} testID={testID} style={styles.box}>
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value ?? placeholder ?? ""}
        </Text>
        <ChevronDown size={18} color="#697A93" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, width: "100%" },
  label: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.ink },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brand.white,
    borderRadius: radii.sm + 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#D3DFF4"
  },
  value: { flex: 1, fontFamily: "Geist_500Medium", fontSize: 15, color: colors.brand.ink },
  placeholder: { color: colors.text.secondary }
});
