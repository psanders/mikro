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
 *
 * The pill body itself is the presentational `RecordingPill` (stop + discard
 * controls); this component only owns the floating placement and the wiring to
 * the bug-report context.
 */
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBugReport } from "../../lib/bugReport/BugReportContext";
import { RecordingPill } from "./RecordingPill";

export function BugReportPill() {
  const { stage, elapsedSeconds, stopRecording, discardRecording } = useBugReport();
  const insets = useSafeAreaInsets();

  if (stage !== "recording") return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none">
      <RecordingPill
        elapsedSeconds={elapsedSeconds}
        onStop={stopRecording}
        onDiscard={discardRecording}
      />
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
  }
});
