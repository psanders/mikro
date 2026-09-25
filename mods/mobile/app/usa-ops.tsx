/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Landing for REVIEWER-only accounts. Application review moved from this app
 * to the Ops desktop app (openspec add-application-review-flow); the mobile
 * app is the collector app. Offers a way out (sign out) so a shared phone can
 * switch to a collector account.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Monitor } from "lucide-react-native";
import { colors, radii, spacing } from "../lib/theme";
import { clearNavMode, clearPin, clearToken, clearUserName } from "../lib/auth";

export default function UsaOpsScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen} testID="usa-ops-screen">
      <View style={styles.card}>
        <View style={styles.icon}>
          <Monitor size={26} color={colors.brand.blue.primary} strokeWidth={2} />
        </View>
        <Text style={styles.title}>La evaluación ahora está en el panel de Ops</Text>
        <Text style={styles.body}>
          Toma solicitudes, sube la evidencia y registra desembolsos desde el panel de Ops en tu
          computadora. Esta app es para los cobros en la calle.
        </Text>
        <Pressable
          style={styles.button}
          onPress={async () => {
            await clearToken();
            await clearPin();
            await clearUserName();
            await clearNavMode();
            router.replace("/(auth)/login");
          }}
        >
          <Text style={styles.buttonText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.screen,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.brand.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.card,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: colors.brand.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  title: { fontSize: 17, fontWeight: "600", color: colors.brand.ink, textAlign: "center" },
  body: { fontSize: 13, lineHeight: 20, color: colors.text.meta, textAlign: "center" },
  button: {
    marginTop: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: 10,
    paddingHorizontal: 18
  },
  buttonText: { fontSize: 14, fontWeight: "600", color: colors.brand.ink }
});
