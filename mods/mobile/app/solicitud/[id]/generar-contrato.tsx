/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04e Generar contrato` (t2s00): post-approval, stateless
 * contract render — `generateApplicationContract` doesn't persist anything or
 * change status (only `uploadSignedContract`, wired on the detail screen's
 * "Firmada" flow, does). Shares/downloads the rendered PDF on success (task 7.1).
 *
 * The "Primera cuota" field is a frequency-aware calendar (shared
 * `CalendarPicker`): its minimum and default are one payment period out, so a
 * weekly contract can't print a first cuota of today, a biweekly one next
 * week, etc. Matches the convert screen's picker exactly.
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
import { CalendarPicker } from "../../../components/ui/CalendarPicker";
import { BtnCta } from "../../../components/ui/BtnCta";
import {
  addPaymentPeriod,
  applicantName,
  formatDate,
  startOfToday
} from "../../../lib/applications";
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

export default function GenerarContratoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = trpc.getApplication.useQuery({ id });
  const app = q.data;

  const [gender, setGender] = useState<"M" | "F">("F");
  const [installments, setInstallments] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("WEEKLY");
  const [startDate, setStartDate] = useState<Date>(() =>
    addPaymentPeriod(startOfToday(), "WEEKLY")
  );
  const [openPicker, setOpenPicker] = useState<"gender" | "frequency" | "date" | null>(null);

  // First cuota can't be sooner than one payment period out; default to it, and
  // snap back whenever the frequency changes (see convert screen for the same
  // rule and CalendarPicker for the gating).
  const minStartDate = addPaymentPeriod(startOfToday(), frequency);
  useEffect(() => {
    setStartDate(addPaymentPeriod(startOfToday(), frequency));
  }, [frequency]);

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

  const valid = Number(installments) > 0 && Number(installmentAmount) > 0;
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
              value={formatDate(startDate)}
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
              startDate: new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate(),
                12
              ).toISOString()
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
      <CalendarPicker
        visible={openPicker === "date"}
        title="Primera cuota"
        value={startDate}
        minDate={minStartDate}
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
