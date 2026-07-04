/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04h Convertir en cliente` (I7lMge): dedicated loan-terms
 * form, separate from the contract flow, reached from the "Firmada" state's
 * collapsed "Convertir en cliente" button (task 8.1). Wires
 * `convertApplication` (principal, termLength, paymentAmount,
 * paymentFrequency, assignedCollectorId — `convertApplicationSchema` in
 * `mods/common/src/schemas/application.ts`). Collector assignment is
 * REQUIRED (mikro/#41: every customer must have a collector, enforced at the
 * DB, Zod, and UI layers) — the submit button stays disabled until one is
 * picked.
 */
import { useEffect, useState } from "react";
import { Alert, View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { colors } from "../../../lib/theme";
import { trpc } from "../../../lib/api";
import { Header } from "../../../components/ui/Header";
import { Input } from "../../../components/ui/Input";
import { SelectField } from "../../../components/ui/SelectField";
import { PickerModal } from "../../../components/ui/PickerModal";
import { BtnCta } from "../../../components/ui/BtnCta";
import { applicantName, formatDate } from "../../../lib/applications";

type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "DAILY", label: "Diaria" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" }
];

// Preset start-date picker (hoy / +7 / +15 / +30 días), mirroring the "Primera
// cuota" field on the contract screen — no native calendar dependency in the
// app. Defaults to today so the loan always starts on a sensible date, but the
// reviewer can push it out to match the negotiated first-payment date.
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

export default function ConvertirScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const q = trpc.getApplication.useQuery({ id });
  const app = q.data;
  const usersQuery = trpc.listUsers.useQuery({});
  const collectors = (usersQuery.data ?? []).filter((u) =>
    u.roles?.some((r) => r.role === "COLLECTOR")
  );

  const [principal, setPrincipal] = useState("");
  const [termLength, setTermLength] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentFrequency, setPaymentFrequency] = useState<Frequency>("WEEKLY");
  const [assignedCollectorId, setAssignedCollectorId] = useState<string | undefined>();
  const dOpts = dateOptions();
  const [startingDate, setStartingDate] = useState(dOpts[0].value);
  const [openFrequency, setOpenFrequency] = useState(false);
  const [openCollector, setOpenCollector] = useState(false);
  const [openStartDate, setOpenStartDate] = useState(false);

  useEffect(() => {
    if (!app) return;
    if (!principal && app.requestedAmount != null)
      setPrincipal(String(Number(app.requestedAmount)));
    if (!termLength && app.requestedTermWeeks) setTermLength(String(app.requestedTermWeeks));
  }, [app, principal, termLength]);

  const convert = trpc.convertApplication.useMutation({
    onSuccess: () => {
      void utils.getApplication.invalidate({ id });
      void utils.listApplications.invalidate();
      router.back();
    },
    onError: (err) => Alert.alert("Error", `No se pudo convertir la solicitud. ${err.message}`)
  });

  const valid =
    Number(principal) > 0 &&
    Number(termLength) > 0 &&
    Number(paymentAmount) > 0 &&
    Boolean(assignedCollectorId);
  const name = app ? applicantName(app) : "";

  return (
    <View style={styles.screen}>
      <Header title="Convertir en cliente" subtitle={name} backMode="close" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>
          Términos negociados del préstamo. Al confirmar se crea el cliente y el préstamo.
        </Text>

        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Principal (RD$)"
              value={principal}
              onChangeText={setPrincipal}
              keyboardType="numeric"
              testID="field-principal"
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Plazo (cuotas)"
              value={termLength}
              onChangeText={setTermLength}
              keyboardType="numeric"
              testID="field-term"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Cuota (RD$)"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="numeric"
              testID="field-payment-amount"
            />
          </View>
          <View style={styles.half}>
            <SelectField
              label="Frecuencia"
              value={FREQUENCY_OPTIONS.find((o) => o.value === paymentFrequency)?.label}
              onPress={() => setOpenFrequency(true)}
              testID="field-frequency"
            />
          </View>
        </View>

        <SelectField
          label="Fecha de inicio"
          value={dOpts.find((o) => o.value === startingDate)?.label}
          onPress={() => setOpenStartDate(true)}
          testID="field-starting-date"
        />

        <SelectField
          label="Cobrador asignado"
          value={collectors.find((c) => c.id === assignedCollectorId)?.name}
          onPress={() => setOpenCollector(true)}
          testID="field-collector"
        />
      </ScrollView>

      <View style={styles.actionBar}>
        <BtnCta
          label={convert.isPending ? "Convirtiendo…" : "Convertir y crear préstamo"}
          icon={Check}
          color={colors.status.success}
          disabled={!valid || convert.isPending}
          onPress={() =>
            convert.mutate({
              id,
              principal: Number(principal),
              termLength: Number(termLength),
              paymentAmount: Number(paymentAmount),
              paymentFrequency,
              startingDate: new Date(`${startingDate}T12:00:00`),
              assignedCollectorId: assignedCollectorId!
            })
          }
        />
        <Text style={styles.cancel} onPress={() => router.back()}>
          Cancelar
        </Text>
      </View>

      <PickerModal
        visible={openFrequency}
        title="Frecuencia"
        options={FREQUENCY_OPTIONS}
        value={paymentFrequency}
        onSelect={(v) => setPaymentFrequency(v as Frequency)}
        onClose={() => setOpenFrequency(false)}
      />

      <PickerModal
        visible={openStartDate}
        title="Fecha de inicio"
        options={dOpts}
        value={startingDate}
        onSelect={setStartingDate}
        onClose={() => setOpenStartDate(false)}
      />

      <PickerModal
        visible={openCollector}
        title="Cobrador asignado"
        options={collectors.map((c) => ({ value: c.id, label: c.name }))}
        value={assignedCollectorId}
        onSelect={(v) => setAssignedCollectorId(v)}
        onClose={() => setOpenCollector(false)}
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
