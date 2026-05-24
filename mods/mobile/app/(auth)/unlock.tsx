/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import { Avatar } from "../../components/ui/Avatar";
import { PinInput } from "../../components/ui/PinInput";
import { PinKeypad } from "../../components/ui/PinKeypad";
import { getPin, clearToken, clearPin, getUserName, clearUserName } from "../../lib/auth";

const PIN_LENGTH = 4;

export default function UnlockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);
  const [name, setName] = useState("...");

  useEffect(() => {
    getUserName().then((n) => {
      if (n) setName(n);
    });
  }, []);

  async function handleKey(key: string) {
    if (key === "delete") {
      setEntered((prev) => prev.slice(0, -1));
      setError(false);
      return;
    }
    if (key === "") return;

    const next = entered + key;
    if (next.length < PIN_LENGTH) {
      setEntered(next);
      setError(false);
      return;
    }

    const storedPin = await getPin();
    if (next === storedPin) {
      router.replace("/(tabs)");
    } else {
      setError(true);
      setEntered("");
    }
  }

  async function handleChangeUser() {
    await clearToken();
    await clearPin();
    await clearUserName();
    router.replace("/(auth)/login");
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoM}>m</Text>
            </View>
            <Text style={styles.logoWord}>mikro</Text>
          </View>

          <Avatar name={name} size={84} />

          <View style={styles.greetingWrap}>
            <Text style={styles.greeting}>Hola, {name.split(" ")[0]}.</Text>
            <Text style={[styles.subtitle, error && styles.subtitleError]}>
              {error ? "PIN incorrecto. Intenta de nuevo." : "Ingresa tu PIN para continuar"}
            </Text>
          </View>
        </View>

        <View style={styles.pinSection}>
          <PinInput length={PIN_LENGTH} filled={entered.length} error={error} />
          <Text style={styles.pinHint}>PIN suministrado por tu oficina</Text>
        </View>

        <PinKeypad onPress={handleKey} />
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() =>
            Alert.alert("PIN olvidado", "Contacta a tu administrador para restablecer tu PIN.")
          }
        >
          <Text style={styles.forgotLink}>¿Olvidaste tu PIN?</Text>
        </Pressable>
        <Pressable onPress={handleChangeUser}>
          <Text style={styles.changeUserLink}>Cambiar usuario</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand.white },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingTop: 48
  },
  header: { alignItems: "center", gap: 24 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brand.blue.deep,
    alignItems: "center",
    justifyContent: "center"
  },
  logoM: {
    fontFamily: "Geist_700Bold",
    fontSize: 24,
    color: colors.brand.white,
    lineHeight: 24
  },
  logoWord: {
    fontFamily: "Geist_700Bold",
    fontSize: 32,
    color: colors.brand.blue.deep,
    letterSpacing: -0.5
  },
  greetingWrap: { alignItems: "center", gap: 6 },
  greeting: {
    fontFamily: "Geist_700Bold",
    fontSize: 30,
    color: colors.brand.blue.deep,
    letterSpacing: -0.5
  },
  subtitle: { fontFamily: "Geist_500Medium", fontSize: 14, color: colors.text.secondary },
  subtitleError: { color: colors.brand.orange.deep },
  pinSection: { alignItems: "center", gap: 14 },
  pinHint: { fontFamily: "Geist_500Medium", fontSize: 11, color: colors.text.secondary },
  footer: { alignItems: "center", gap: 14, paddingBottom: 32, paddingTop: 16 },
  forgotLink: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.blue.primary },
  changeUserLink: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.text.secondary }
});
