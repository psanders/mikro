/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04e Generar contrato` (t2s00): post-approval, stateless
 * contract render — `generateApplicationContract` doesn't persist anything or
 * change status (only `uploadSignedContract`, wired on the detail screen's
 * "Firmada" flow, does). Shares/downloads the rendered PDF on success (task 7.1).
 *
 * There's no date-picker dependency in the app yet; the "Primera cuota" field
 * uses a small preset picker (hoy / +7 / +15 / +30 días) instead of a native
 * calendar widget, to stay within already-installed dependencies.
 */
import { useEffect, useState } from "react";
import { Alert, View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FileDown } from "lucide-react-native";
import { colors } from "../../../lib/theme";
import { trpc } from "../../../lib/api";
import { Header } from "../../../components/ui/Header";
import { Input } from "../../../components/ui/Input";
import { SelectField } from "../../../components/ui/SelectField";
import { PickerModal } from "../../../components/ui/PickerModal";
import { BtnCta } from "../../../components/ui/BtnCta";
import { applicantName, formatDate } from "../../../lib/applications";
import { shareContractPdf } from "../../../lib/shareContract";

type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "DAILY", label: "Diaria" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" }
];

const GENDER_OPTIONS = [
  { value: "F", label: "Femenino" },
  { value: "M", label: "Masculino" }
];

function dateOptions(): { value: string; label: string }[] {
  const today = new Date();
  return [0, 7, 15, 30].map((n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return {
      value: d.toISOString().slice(0, 10),
      label: n === 0 ? `Hoy · ${formatDate(d)}` : `En ${n} días · ${formatDate(d)}`
    };
  });
}

export default function GenerarContratoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = trpc.getApplication.useQuery({ id });
  const app = q.data;

  const [gender, setGender] = useState<"M" | "F">("F");
  const [installments, setInstallments] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("WEEKLY");
  const dOpts = dateOptions();
  const [startDate, setStartDate] = useState(dOpts[0].value);
  const [openPicker, setOpenPicker] = useState<"gender" | "frequency" | "date" | null>(null);

  useEffect(() => {
    if (app?.requestedTermWeeks && !installments) setInstallments(String(app.requestedTermWeeks));
  }, [app, installments]);

  const generate = trpc.generateApplicationContract.useMutation({
    onSuccess: async (r) => {
      try {
        await shareContractPdf(r.dataBase64, r.filename);
      } finally {
        router.back();
      }
    },
    onError: (err) => Alert.alert("Error", `No se pudo generar el contrato. ${err.message}`)
  });

  const valid = Number(installments) > 0 && Number(installmentAmount) > 0 && !!startDate;
  const name = app ? applicantName(app) : "";

  return (
    <View style={styles.screen}>
      <Header title="Generar contrato" subtitle={name} backMode="close" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>
          Términos negociados del préstamo. Se usan para el contrato (PDF).
        </Text>

        <SelectField
          label="Sexo (para el contrato)"
          value={GENDER_OPTIONS.find((o) => o.value === gender)?.label}
          onPress={() => setOpenPicker("gender")}
          testID="field-gender"
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Cuotas"
              value={installments}
              onChangeText={setInstallments}
              keyboardType="numeric"
              testID="field-installments"
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Valor cuota (RD$)"
              value={installmentAmount}
              onChangeText={setInstallmentAmount}
              keyboardType="numeric"
              testID="field-installment-amount"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <SelectField
              label="Frecuencia"
              value={FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.label}
              onPress={() => setOpenPicker("frequency")}
              testID="field-frequency"
            />
          </View>
          <View style={styles.half}>
            <SelectField
              label="Primera cuota"
              value={dOpts.find((o) => o.value === startDate)?.label}
              onPress={() => setOpenPicker("date")}
              testID="field-start-date"
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <BtnCta
          label={generate.isPending ? "Generando…" : "Generar y descargar"}
          icon={FileDown}
          color={colors.brand.blue.deep}
          disabled={!valid || generate.isPending}
          onPress={() =>
            generate.mutate({
              id,
              gender,
              installments: Number(installments),
              installmentAmount: Number(installmentAmount),
              frequency,
              startDate: new Date(`${startDate}T12:00:00`).toISOString()
            })
          }
        />
        <Text style={styles.cancel} onPress={() => router.back()}>
          Cancelar
        </Text>
      </View>

      <PickerModal
        visible={openPicker === "gender"}
        title="Sexo (para el contrato)"
        options={GENDER_OPTIONS}
        value={gender}
        onSelect={(v) => setGender(v as "M" | "F")}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === "frequency"}
        title="Frecuencia"
        options={FREQUENCY_OPTIONS}
        value={frequency}
        onSelect={(v) => setFrequency(v as Frequency)}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === "date"}
        title="Primera cuota"
        options={dOpts}
        value={startDate}
        onSelect={setStartDate}
        onClose={() => setOpenPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 },
  intro: { fontFamily: "Geist_500Medium", fontSize: 13, color: colors.text.secondary },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
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
