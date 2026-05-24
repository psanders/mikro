/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, TextInput, StyleSheet } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon?: LucideIcon;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  icon: Icon,
  secureTextEntry,
  keyboardType
}: InputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.box}>
        {Icon && <Icon size={18} color={colors.brand.blue.primary} strokeWidth={2} />}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.secondary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
        />
      </View>
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
    backgroundColor: colors.brand.mist,
    borderRadius: radii.sm + 4,
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  input: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 15,
    color: colors.brand.ink,
    padding: 0
  }
});
