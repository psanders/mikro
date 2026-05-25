/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight, User, Lock } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import { Input } from "../../components/ui/Input";
import { BtnCta } from "../../components/ui/BtnCta";
import { api } from "../../lib/trpc";
import { setToken, getPin, setPin, setUserName } from "../../lib/auth";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function handlePhoneChange(text: string) {
    setPhone(formatPhone(text));
  }

  async function handleLogin() {
    if (!phone.trim() || !password.trim()) {
      Alert.alert("Error", "Ingresa tu teléfono y contraseña.");
      return;
    }

    setLoading(true);
    try {
      const digits = phone.replace(/\D/g, "");
      const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
      const result = await api.login.mutate({ phone: e164, password });
      await setToken(result.token);
      if (result.name) await setUserName(result.name);
      const existingPin = await getPin();
      if (!existingPin) {
        await setPin("1234");
      }
      router.replace("/(auth)/unlock");
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message?.includes("Invalid")
          ? "Teléfono o contraseña incorrectos."
          : "No se pudo conectar al servidor. Verifica tu conexión.";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.body, { paddingTop: insets.top + 48 }]}>
        <View style={styles.logo}>
          <View style={styles.logoMark}>
            <Text style={styles.logoM}>m</Text>
          </View>
          <Text style={styles.logoWord}>mikro</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.h1}>Bienvenido.</Text>
          <Text style={styles.h2}>Cobra rápido, sin complicaciones.</Text>
        </View>

        <View style={styles.form}>
          <Input
            testID="phone-input"
            label="Teléfono"
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="809-555-0100"
            icon={User}
            keyboardType="phone-pad"
            textContentType="none"
            autoComplete="off"
          />
          <Input
            testID="password-input"
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            icon={Lock}
            secureTextEntry
            textContentType="none"
            autoComplete="off"
          />
          <Pressable>
            <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>
          </Pressable>
        </View>

        <BtnCta
          label={loading ? "Entrando…" : "Iniciar sesión"}
          icon={ArrowRight}
          onPress={handleLogin}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand.white },
  body: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 32,
    gap: 32
  },
  logo: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brand.blue.deep,
    alignItems: "center",
    justifyContent: "center"
  },
  logoM: { fontFamily: "Geist_700Bold", fontSize: 24, color: colors.brand.white, lineHeight: 24 },
  logoWord: {
    fontFamily: "Geist_700Bold",
    fontSize: 28,
    color: colors.brand.blue.deep,
    letterSpacing: -0.5
  },
  hero: { gap: 10 },
  h1: {
    fontFamily: "Geist_700Bold",
    fontSize: 36,
    color: colors.brand.blue.deep,
    letterSpacing: -1
  },
  h2: { fontFamily: "Geist_500Medium", fontSize: 16, color: colors.brand.ink, lineHeight: 22 },
  form: { gap: 14 },
  forgot: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.blue.primary }
});
