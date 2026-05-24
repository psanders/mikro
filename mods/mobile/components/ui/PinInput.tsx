/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";

interface PinInputProps {
  length: number;
  filled: number;
  error?: boolean;
}

export function PinInput({ length, filled, error }: PinInputProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < filled;
        const isActive = i === filled && !error;
        return (
          <View
            key={i}
            style={[styles.box, isActive && styles.boxActive, error && styles.boxError]}
          >
            {isFilled && <Text style={styles.dot}>●</Text>}
            {isActive && <View style={styles.cursor} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 14 },
  box: {
    width: 58,
    height: 68,
    borderRadius: 14,
    backgroundColor: colors.brand.mist,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D3DFF4"
  },
  boxActive: {
    backgroundColor: colors.brand.white,
    borderWidth: 2,
    borderColor: colors.brand.blue.deep
  },
  boxError: { borderColor: colors.brand.orange.deep },
  dot: { fontFamily: "Geist_700Bold", fontSize: 22, color: colors.brand.ink },
  cursor: {
    width: 2,
    height: 26,
    borderRadius: 1,
    backgroundColor: colors.brand.blue.deep
  }
});
