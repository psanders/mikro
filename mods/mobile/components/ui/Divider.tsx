/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";

export function Divider() {
  return <View style={styles.line} />;
}

const styles = StyleSheet.create({
  line: { height: 1, backgroundColor: colors.border.light, width: "100%" }
});
