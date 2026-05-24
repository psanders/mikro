/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, View, Text, StyleSheet } from "react-native";
import { colors, radii } from "../../lib/theme";

interface OptionRowProps {
  label: string;
  value?: string;
  selected?: boolean;
  onPress?: () => void;
}

export function OptionRow({ label, value, selected, onPress }: OptionRowProps) {
  return (
    <Pressable onPress={onPress} style={[styles.container, selected && styles.selectedContainer]}>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
      {value && <Text style={styles.value}>{value}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.sm + 4,
    backgroundColor: colors.brand.white,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D3DFF4"
  },
  selectedContainer: { borderColor: colors.brand.blue.primary },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.text.secondary,
    alignItems: "center",
    justifyContent: "center"
  },
  radioSelected: { borderColor: colors.brand.blue.primary, borderWidth: 2 },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand.blue.primary },
  label: { fontFamily: "Geist_500Medium", fontSize: 13, color: colors.brand.ink },
  value: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.blue.primary }
});
