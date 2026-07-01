/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, Text, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";

interface ActionCardProps {
  label: string;
  body: string;
  onPress?: () => void;
  testID?: string;
}

export function ActionCard({ label, body, onPress, testID }: ActionCardProps) {
  return (
    <Pressable onPress={onPress} testID={testID} style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.body}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    backgroundColor: colors.brand.white,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border.card
  },
  label: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#697A93"
  },
  body: { fontFamily: "Geist_500Medium", fontSize: 13, color: "#697A93" }
});
