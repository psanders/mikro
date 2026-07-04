/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Bottom-sheet month calendar for picking a single date, with a hard minimum
 * (days before `minDate` are disabled and unselectable). Pure React Native —
 * no native date-picker dependency, matching the app's deliberate choice to
 * stay within already-installed packages. Used by the convert screen's
 * "Primera cuota" field, where the minimum is one payment period out so a
 * weekly loan can't have its first cuota today, a biweekly one next week, etc.
 */
import { useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { X, ChevronLeft, ChevronRight } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";

interface CalendarPickerProps {
  visible: boolean;
  title: string;
  value: Date;
  /** Earliest selectable day (inclusive). Days before it are disabled. */
  minDate: Date;
  onSelect: (value: Date) => void;
  onClose: () => void;
}

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthTitle(year: number, month: number): string {
  const label = new Intl.DateTimeFormat("es-DO", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function CalendarPicker({
  visible,
  title,
  value,
  minDate,
  onSelect,
  onClose
}: CalendarPickerProps) {
  const [view, setView] = useState({ year: value.getFullYear(), month: value.getMonth() });

  const min = atMidnight(minDate);
  const firstOfMonth = new Date(view.year, view.month, 1);
  // Monday-first offset (JS getDay is Sunday-first).
  const leading = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  // Disable navigating to months entirely before the minimum.
  const prevDisabled =
    view.year < min.getFullYear() ||
    (view.year === min.getFullYear() && view.month <= min.getMonth());

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(view.year, view.month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const shiftMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} testID="calendar-close">
            <X size={20} color={colors.text.secondary} strokeWidth={2} />
          </Pressable>
        </View>

        <View style={styles.monthNav}>
          <Pressable
            onPress={() => !prevDisabled && shiftMonth(-1)}
            hitSlop={8}
            disabled={prevDisabled}
            testID="calendar-prev"
          >
            <ChevronLeft
              size={22}
              color={prevDisabled ? colors.border.card : colors.brand.ink}
              strokeWidth={2}
            />
          </Pressable>
          <Text style={styles.monthLabel}>{monthTitle(view.year, view.month)}</Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={8} testID="calendar-next">
            <ChevronRight size={22} color={colors.brand.ink} strokeWidth={2} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={styles.weekday}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((date, i) => {
            if (!date) return <View key={i} style={styles.cell} />;
            const disabled = date < min;
            const selected = sameDay(date, value);
            return (
              <Pressable
                key={i}
                style={styles.cell}
                disabled={disabled}
                onPress={() => {
                  onSelect(date);
                  onClose();
                }}
                testID={`calendar-day-${date.getDate()}`}
              >
                <View style={[styles.dayInner, selected && styles.daySelected]}>
                  <Text
                    style={[
                      styles.dayText,
                      disabled && styles.dayDisabled,
                      selected && styles.daySelectedText
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20, 37, 74, 0.4)" },
  sheet: {
    backgroundColor: colors.brand.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: 28
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.card
  },
  title: { fontFamily: "Geist_700Bold", fontSize: 16, color: colors.brand.ink },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8
  },
  monthLabel: { fontFamily: "Geist_600SemiBold", fontSize: 15, color: colors.brand.ink },
  weekRow: { flexDirection: "row", paddingHorizontal: 12, paddingBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    color: colors.text.secondary
  },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12 },
  cell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4
  },
  dayInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center"
  },
  daySelected: { backgroundColor: colors.brand.blue.primary },
  dayText: { fontFamily: "Geist_500Medium", fontSize: 15, color: colors.brand.ink },
  dayDisabled: { color: colors.border.card },
  daySelectedText: { color: colors.brand.white, fontFamily: "Geist_700Bold" }
});
