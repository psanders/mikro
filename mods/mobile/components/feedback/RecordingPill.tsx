/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Presentational recording pill (Pencil node `zMnuA` inside `OWGz8`). Pure —
 * takes the elapsed time and the stop/discard callbacks and renders the pill
 * body only; the floating absolute positioning + context wiring live in
 * `FeedbackPill`. Split out so the visual can be exercised in Storybook
 * without a live recording session, and to keep exact parity with the
 * dashboard's `RecordingPill` (same props: elapsedSeconds / onStop /
 * onDiscard).
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Square, Trash2 } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";

export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface RecordingPillProps {
  elapsedSeconds: number;
  /** Stop recording and submit the report. */
  onStop: () => void;
  /** Throw the in-progress recording away and return to idle. */
  onDiscard: () => void;
}

export function RecordingPill({ elapsedSeconds, onStop, onDiscard }: RecordingPillProps) {
  return (
    <View style={styles.pill}>
      <View style={styles.left}>
        <View style={styles.dot} />
        <Text style={styles.label}>Grabando · {formatElapsed(elapsedSeconds)}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.discardBtn}
          onPress={onDiscard}
          hitSlop={8}
          accessibilityLabel="Descartar grabación"
        >
          <Trash2 size={14} color={colors.brand.white} strokeWidth={2} />
        </Pressable>
        <Pressable
          style={styles.stopBtn}
          onPress={onStop}
          hitSlop={8}
          accessibilityLabel="Detener y enviar"
        >
          <Square size={14} color={colors.brand.white} fill={colors.brand.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.brand.ink,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingLeft: 18,
    paddingRight: 10
  },
  left: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.status.danger },
  label: { fontFamily: "Geist_700Bold", fontSize: 13, color: colors.brand.white },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  discardBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center"
  },
  stopBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.status.danger,
    alignItems: "center",
    justifyContent: "center"
  }
});
