/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Bottom-sheet option list backing `SelectField` (`m/select-field`) wherever an
 * evaluator form screen needs an enum picker (Editar·Negocio, Generar
 * contrato, Convertir a préstamo). Not a Pencil-speced node itself — plain
 * implementation detail reusing the already-built `OptionRow` component.
 */
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { X } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";
import { OptionRow } from "./OptionRow";

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  value?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function PickerModal({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose
}: PickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} testID="picker-close">
            <X size={20} color={colors.text.secondary} strokeWidth={2} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {options.map((o) => (
            <OptionRow
              key={o.value}
              label={o.label}
              selected={o.value === value}
              onPress={() => {
                onSelect(o.value);
                onClose();
              }}
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20, 37, 74, 0.4)" },
  sheet: {
    maxHeight: "70%",
    backgroundColor: colors.brand.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: 24
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
  list: { padding: 18, gap: 8 }
});
