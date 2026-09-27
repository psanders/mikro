/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Hoy's entry to the evidence list (Pencil w7Ncnt): how many applications in
 * review still miss evidence and how long the oldest has waited. Hidden when
 * offline or when nothing is missing.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Camera, ChevronRight } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";
import { trpc } from "../../lib/api";
import { inReviewLabel } from "../../lib/evidence";

export function EvidenceEntryCard({ isOnline }: { isOnline: boolean }) {
  const router = useRouter();
  const queue = trpc.listEvidenceQueue.useQuery(undefined, { enabled: isOnline });
  const pending = (queue.data ?? []).filter((i) => !i.complete);
  if (!isOnline || pending.length === 0) return null;

  const oldest = inReviewLabel(pending[0]!.inReviewSince)
    .replace("En evaluación ", "")
    .replace("desde hoy", "de hoy");
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push("/evidencias")}
      testID="evidence-entry"
    >
      <View style={styles.icon}>
        <Camera size={18} color={colors.brand.orange.deep} strokeWidth={2} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Evidencias por recoger</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {pending.length} solicitud{pending.length > 1 ? "es" : ""} · la más antigua {oldest}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.text.secondary} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: colors.brand.white
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.ink },
  sub: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.text.secondary }
});
