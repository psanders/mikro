/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";

interface RailCardProps {
  label: string;
  children: ReactNode;
}

/**
 * Labeled white card wrapper for the evaluator detail screens' rail sections
 * (score, progress, review, documents, suggested questions...). Visually
 * matches `ActionCard`'s container, but accepts arbitrary children instead of
 * a single body string — those sections hold rich nested content.
 */
export function RailCard({ label, children }: RailCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
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
  }
});
