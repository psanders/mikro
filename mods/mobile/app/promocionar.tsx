/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Native replacement for the WhatsApp collector-chat promotion capability
 * (mikro/#68): a collector types the new customer's phone number and taps
 * send — no photo capture, no computer-vision phone extraction, no WhatsApp
 * button-reply round trip. Backed by the existing `sendPromo` mutation
 * (already used by the manual-creation flow and the CLI), so the WhatsApp
 * intake Flow / template on the receiving end is unchanged.
 */
import { useState } from "react";
import { Alert, View, Text, ScrollView, StyleSheet } from "react-native";
import { Phone, Send } from "lucide-react-native";
import { colors } from "../lib/theme";
import { Header } from "../components/ui/Header";
import { Input } from "../components/ui/Input";
import { BtnCta } from "../components/ui/BtnCta";
import { trpc } from "../lib/api";

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function PromocionarScreen() {
  const [phone, setPhone] = useState("");
  const sendPromo = trpc.sendPromo.useMutation();

  const digits = phone.replace(/\D/g, "");
  const isValid = digits.length === 10;

  function handlePhoneChange(text: string) {
    setPhone(formatPhone(text));
  }

  function handleSend() {
    if (!isValid || sendPromo.isPending) return;
    const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
    sendPromo.mutate(
      { phone: e164 },
      {
        onSuccess: (result) => {
          if (result.sent) {
            Alert.alert("Promoción enviada", `Se envió la promoción a ${phone}.`);
            setPhone("");
          } else {
            Alert.alert("No se pudo enviar", result.error ?? "Intenta de nuevo.");
          }
        },
        onError: (err) => {
          Alert.alert("Error", `No se pudo enviar la promoción. ${err.message}`);
        }
      }
    );
  }

  return (
    <View style={styles.screen}>
      <Header title="Nueva promoción" backMode="close" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>
          Envía la promoción de solicitud de préstamo directamente al teléfono de un cliente nuevo —
          sin foto, sin pasos extra.
        </Text>

        <Input
          label="Teléfono del cliente nuevo"
          value={phone}
          onChangeText={handlePhoneChange}
          placeholder="809-555-0100"
          icon={Phone}
          keyboardType="phone-pad"
          testID="promo-phone-input"
        />

        <BtnCta
          label={sendPromo.isPending ? "Enviando…" : "Enviar promoción"}
          icon={Send}
          disabled={!isValid || sendPromo.isPending}
          onPress={handleSend}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 16 },
  hint: {
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19
  }
});
