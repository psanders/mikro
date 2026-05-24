/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "../../lib/theme";

interface StatCardProps {
  value: string;
  label: string;
}

export function StatCard({ value, label }: StatCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.brand.white,
    borderRadius: radii.card,
    padding: 14,
    gap: 2,
    flex: 1
  },
  value: { fontFamily: "Geist_700Bold", fontSize: 18, color: colors.brand.blue.deep },
  label: { fontFamily: "Geist_500Medium", fontSize: 11, color: colors.text.secondary }
});
