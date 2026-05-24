/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";

interface KvRowProps {
  label: string;
  value: string;
}

export function KvRow({ label, value }: KvRowProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%"
  },
  label: { fontFamily: "Geist_500Medium", fontSize: 13, color: colors.text.secondary },
  value: { fontFamily: "Geist_700Bold", fontSize: 13, color: colors.brand.ink }
});
