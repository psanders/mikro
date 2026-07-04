/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Floating recording indicator (Pencil node `OWGz8`, extend-bug-report-native-
 * capture). Rendered as a plain absolutely-positioned view (NOT a `<Modal>`)
 * so it floats above whatever screen the user has navigated to while staying
 * fully non-blocking — the whole point is that recording keeps going while
 * they move around the app to show the bug.
 *
 * `<Modal transparent>` was tried first and looked right in review, but real
 * device testing on iOS showed it silently blocks all touches to the
 * underlying screen regardless of `pointerEvents="box-none"` — iOS presents
 * `Modal` as its own full-screen view controller at the OS level, which
 * intercepts touch dispatch before RN's JS-side pointerEvents logic ever
 * gets a say (Android's `Modal` is just an overlay Dialog in the same window
 * and doesn't have this problem, which is why it wasn't caught by cross-
 * platform code review alone). A plain View with `position: "absolute"`,
 * rendered as a sibling of the app's own content, avoids the OS-level modal
 * presentation entirely and reliably passes touches through on both
 * platforms.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();

  if (stage !== "recording") return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none">
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
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    alignItems: "center",
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
