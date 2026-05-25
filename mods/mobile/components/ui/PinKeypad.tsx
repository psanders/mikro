/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";

interface PinKeypadProps {
  onPress: (key: string) => void;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "delete"]
];

export function PinKeypad({ onPress }: PinKeypadProps) {
  return (
    <View style={styles.keypad}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key, ki) => (
            <Pressable
              key={key || `empty-${ki}`}
              style={({ pressed }) => [
                styles.key,
                key === "" && styles.keyHidden,
                key === "delete" && styles.keyDelete,
                pressed && key !== "" && styles.keyPressed
              ]}
              onPress={() => onPress(key)}
              disabled={key === ""}
            >
              <Text style={styles.keyText}>{key === "delete" ? "⌫" : key}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  keypad: { gap: 10, width: "100%" },
  row: { flexDirection: "row", gap: 10 },
  key: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.bg.screen,
    alignItems: "center",
    justifyContent: "center"
  },
  keyHidden: { backgroundColor: "transparent" },
  keyDelete: { backgroundColor: colors.brand.white },
  keyPressed: { backgroundColor: colors.border.light },
  keyText: { fontFamily: "Geist_600SemiBold", fontSize: 22, color: colors.brand.ink }
});
