/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { View, Text, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../lib/theme";
import { Header } from "../components/ui/Header";
import { PinInput } from "../components/ui/PinInput";
import { PinKeypad } from "../components/ui/PinKeypad";
import { getPin, setPin } from "../lib/auth";

const PIN_LENGTH = 4;

type Step = "verify" | "new" | "confirm";

const STEP_TITLE: Record<Step, string> = {
  verify: "Ingresa tu PIN actual",
  new: "Ingresa tu nuevo PIN",
  confirm: "Confirma tu nuevo PIN"
};

export default function CambiarPinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("verify");
  const [entered, setEntered] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState(false);

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

    if (step === "verify") {
      const storedPin = await getPin();
      if (next === storedPin) {
        setEntered("");
        setError(false);
        setStep("new");
      } else {
        setError(true);
        setEntered("");
      }
    } else if (step === "new") {
      setNewPin(next);
      setEntered("");
      setError(false);
      setStep("confirm");
    } else {
      if (next === newPin) {
        await setPin(next);
        Alert.alert("PIN actualizado", "Tu PIN ha sido cambiado exitosamente.", [
          { text: "OK", onPress: () => router.back() }
        ]);
      } else {
        setError(true);
        setEntered("");
      }
    }
  }

  const subtitle = error
    ? step === "verify"
      ? "PIN incorrecto. Intenta de nuevo."
      : "Los PIN no coinciden. Intenta de nuevo."
    : STEP_TITLE[step];

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <Header title="Cambiar PIN" />
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={[styles.subtitle, error && styles.subtitleError]}>{subtitle}</Text>
          <PinInput length={PIN_LENGTH} filled={entered.length} error={error} />
        </View>
        <PinKeypad onPress={handleKey} />
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
    paddingTop: 40,
    paddingBottom: 32
  },
  top: { alignItems: "center", gap: 24 },
  subtitle: { fontFamily: "Geist_500Medium", fontSize: 15, color: colors.text.secondary },
  subtitleError: { color: colors.brand.orange.deep }
});
