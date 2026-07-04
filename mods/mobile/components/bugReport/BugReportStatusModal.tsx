/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Processing / result / error states for the bug-report flow (Pencil nodes
 * `rv2oJ`, `fsDNM`, `oTSL4`). Global like the pill, since the user may have
 * navigated away from Perfil by the time the recording is stopped and
 * processed.
 */
import { Modal, View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { Check, TriangleAlert, RefreshCw, ExternalLink } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";
import { useBugReport } from "../../lib/bugReport/BugReportContext";
import { BtnCta } from "../ui/BtnCta";

export function BugReportStatusModal() {
  const { stage, issueUrl, errorMessage, reset, startRecording } = useBugReport();

  if (stage !== "processing" && stage !== "result" && stage !== "error") return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={reset}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {stage === "processing" && (
            <>
              <Text style={styles.title}>Enviando reporte…</Text>
              <Text style={styles.body}>
                Transcribiendo y creando el reporte en GitHub. Esto puede tardar un momento.
              </Text>
            </>
          )}

          {stage === "result" && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: colors.status.successBg }]}>
                <Check size={26} color={colors.status.success} strokeWidth={2.5} />
              </View>
              <Text style={styles.title}>Reporte enviado</Text>
              <Text style={styles.body}>
                Se creó el reporte. Puedes darle seguimiento en el enlace de abajo.
              </Text>
              {issueUrl && (
                <Pressable style={styles.linkRow} onPress={() => Linking.openURL(issueUrl)}>
                  <Text style={styles.link} numberOfLines={1}>
                    {issueUrl}
                  </Text>
                  <ExternalLink size={14} color={colors.brand.blue.primary} strokeWidth={2} />
                </Pressable>
              )}
              <View style={styles.actions}>
                <BtnCta label="Cerrar" onPress={reset} />
              </View>
            </>
          )}

          {stage === "error" && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: colors.status.dangerBg }]}>
                <TriangleAlert size={26} color={colors.status.danger} strokeWidth={2.5} />
              </View>
              <Text style={styles.title}>No se pudo enviar</Text>
              <Text style={[styles.body, { color: colors.status.danger }]}>
                {errorMessage ?? "Ocurrió un error inesperado."}
              </Text>
              <View style={styles.actions}>
                <BtnCta label="Intentar de nuevo" icon={RefreshCw} onPress={startRecording} />
                <Pressable onPress={reset} style={styles.closeLink}>
                  <Text style={styles.closeLinkText}>Cerrar</Text>
                </Pressable>
              </View>
            </>
          )}
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
  linkRow: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  link: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.blue.primary },
  actions: { width: "100%", gap: 10, marginTop: 4 },
  closeLink: { alignItems: "center", padding: 4 },
  closeLinkText: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.text.secondary }
});
