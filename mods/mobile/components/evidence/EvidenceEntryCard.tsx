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
import { colors } from "../../lib/theme";
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
        <Camera size={20} color={colors.brand.orange.deep} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Evidencias por recoger</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {pending.length} solicitud{pending.length > 1 ? "es" : ""} · la más antigua {oldest}
        </Text>
      </View>
      <View style={styles.count}>
        <Text style={styles.countText}>{pending.length}</Text>
      </View>
      <ChevronRight size={18} color={colors.brand.blue.deep} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.brand.white,
    borderWidth: 1.5,
    borderColor: "#FCD9B6"
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFF1E3",
    alignItems: "center",
    justifyContent: "center"
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: "Geist_700Bold", fontSize: 15, color: colors.brand.ink },
  sub: { fontFamily: "Geist_400Regular", fontSize: 12, color: colors.text.secondary },
  count: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 9999,
    backgroundColor: colors.brand.orange.primary
  },
  countText: { fontFamily: "Geist_700Bold", fontSize: 13, color: colors.brand.white }
});
