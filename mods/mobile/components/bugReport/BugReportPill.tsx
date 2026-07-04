/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Floating recording indicator (Pencil node `OWGz8`, extend-bug-report-native-
 * capture). Rendered via a transparent, non-dismissable `Modal` so it floats
 * above whatever screen the user has navigated to — the whole point is that
 * recording keeps going while they move around the app to show the bug.
 * `pointerEvents="box-none"` on the wrapper means only the pill itself
 * intercepts touches; everything underneath stays fully interactive.
 */
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Square } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";
import { useBugReport } from "../../lib/bugReport/BugReportContext";

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function BugReportPill() {
  const { stage, elapsedSeconds, stopRecording } = useBugReport();

  if (stage !== "recording") return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.wrapper} pointerEvents="box-none">
        <View style={styles.pill}>
          <View style={styles.left}>
            <View style={styles.dot} />
            <Text style={styles.label}>Grabando · {formatElapsed(elapsedSeconds)}</Text>
          </View>
          <Pressable style={styles.stopBtn} onPress={stopRecording} hitSlop={8}>
            <Square size={14} color={colors.brand.white} fill={colors.brand.white} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 100,
    paddingHorizontal: 20
  },
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
  stopBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.status.danger,
    alignItems: "center",
    justifyContent: "center"
  }
});
