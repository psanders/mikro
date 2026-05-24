/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Text, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";

interface SectionLabelProps {
  children: string;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.text.secondary,
    textTransform: "uppercase"
  }
});
