/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Consent step for the feedback flow (Pencil node `v8bmyV`), reusing the
 * web dialog's copy/tone. Adds an Android-only notice: since that platform
 * has no in-app-only recording mode (see FeedbackContext.tsx), anything
 * visible on screen — other apps, notifications — is captured too if the
 * user switches away while recording.
 */
import { Modal, View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { MessageSquare, Circle } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";
import { BtnCta } from "../ui/BtnCta";

interface FeedbackConsentModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FeedbackConsentModal({ visible, onConfirm, onCancel }: FeedbackConsentModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <MessageSquare size={26} color={colors.brand.blue.deep} strokeWidth={2} />
          </View>
          <Text style={styles.title}>Enviar feedback</Text>
          <Text style={styles.body}>
            Esto va a grabar tu pantalla y tu voz mientras muestras lo que quieres compartir — un
            problema, algo confuso o una idea. La grabación se transcribe automáticamente y se usa
            solo para crear el reporte — no se guarda en nuestros servidores. Evita mostrar datos
            sensibles de clientes si es posible.
          </Text>
          {Platform.OS === "android" && (
            <Text style={styles.androidNotice}>
              En Android, la grabación captura todo lo que aparece en pantalla — incluyendo otras
              apps o notificaciones — si sales de Mikro mientras grabas.
            </Text>
          )}
          <View style={styles.actions}>
            <BtnCta label="Empezar a grabar" icon={Circle} onPress={onConfirm} />
            <Pressable onPress={onCancel} style={styles.cancelLink}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 37, 74, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.brand.white,
    borderRadius: radii.lg,
    padding: 24,
    alignItems: "center",
    gap: 12
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    fontFamily: "Geist_700Bold",
    fontSize: 16,
    color: colors.brand.ink,
    textAlign: "center"
  },
  body: {
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 18
  },
  androidNotice: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    color: colors.status.warning,
    textAlign: "center",
    lineHeight: 16,
    backgroundColor: colors.status.warningBg,
    borderRadius: radii.sm,
    padding: 10
  },
  actions: { width: "100%", gap: 10, marginTop: 4 },
  cancelLink: { alignItems: "center", padding: 4 },
  cancelText: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.text.secondary }
});
