/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04j Descartar solicitud` (B5lCa): confirm screen for the
 * detail screen's "Descartar solicitud" action. Hard-deletes via
 * `deleteApplication` (reviewerProcedure) after an explicit confirmation. On
 * success it returns to the queue (the application no longer exists, so we
 * can't go back to its detail screen) and invalidates `listApplications`.
 * Only reachable for non-converted applications — the detail screen hides the
 * discard row once CONVERTED and the backend rejects a converted purge.
 */
import { Alert, View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TriangleAlert, Trash2 } from "lucide-react-native";
import { colors, radii } from "../../../lib/theme";
import { trpc } from "../../../lib/api";
import { Header } from "../../../components/ui/Header";
import { BtnOutline } from "../../../components/ui/BtnOutline";
import { applicantName } from "../../../lib/applications";

export default function DescartarSolicitudScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const q = trpc.getApplication.useQuery({ id });

  const del = trpc.deleteApplication.useMutation({
    onSuccess: () => {
      void utils.listApplications.invalidate();
      router.replace("/(evaluator)");
    },
    onError: (err) => Alert.alert("Error", `No se pudo descartar la solicitud. ${err.message}`)
  });

  const app = q.data;
  const name = app ? applicantName(app) : "";

  return (
    <View style={styles.screen}>
      <Header title="Descartar solicitud" subtitle={name} backMode="close" />
      <View style={styles.body}>
        <View style={styles.warning}>
          <TriangleAlert size={18} color={colors.status.danger} strokeWidth={2} />
          <Text style={styles.warningText}>
            Se elimina de forma permanente. No se puede deshacer.
          </Text>
        </View>
      </View>

      <View style={styles.actionBar}>
        <BtnOutline
          label={del.isPending ? "Eliminando…" : "Eliminar"}
          icon={Trash2}
          color={colors.status.danger}
          disabled={del.isPending}
          onPress={() => del.mutate({ id })}
        />
        <Pressable onPress={() => router.back()} disabled={del.isPending}>
          <Text style={styles.cancel}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: radii.sm + 4,
    backgroundColor: colors.status.dangerBg,
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  warningText: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: colors.brand.ink
  },
  actionBar: {
    gap: 10,
    padding: 20,
    backgroundColor: colors.brand.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light
  },
  cancel: {
    textAlign: "center",
    fontFamily: "Geist_600SemiBold",
    fontSize: 14,
    color: colors.text.secondary
  }
});
