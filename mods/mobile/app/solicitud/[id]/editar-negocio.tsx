/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 04c Editar · Negocio` (o1Cx54): tap-a-section-to-edit —
 * reached from the "NEGOCIO" section on `datos.tsx`. Saves via
 * `updateApplication` (id + patch), which merges the patch over the
 * application's rawData, re-derives the normalized columns, and re-scores
 * server-side (`createUpdateApplication.ts`). Only the Negocio section's
 * fields are sent, per the locked Pencil node (task 5.1/5.2).
 */
import { useEffect, useState } from "react";
import { Alert, View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Phone } from "lucide-react-native";
import { colors } from "../../../lib/theme";
import { trpc } from "../../../lib/api";
import { Header } from "../../../components/ui/Header";
import { Input } from "../../../components/ui/Input";
import { SelectField } from "../../../components/ui/SelectField";
import { PickerModal } from "../../../components/ui/PickerModal";
import { BtnCta } from "../../../components/ui/BtnCta";
import { NEGOCIO_FIELDS, type FieldDef } from "../../../lib/applicationFields";
import { applicantName } from "../../../lib/applications";

function raw(app: { rawData?: unknown } | undefined, key: string): string {
  const v = (app?.rawData as Record<string, unknown> | null | undefined)?.[key];
  return typeof v === "string" && v.trim() ? v : "";
}

export default function EditarNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const q = trpc.getApplication.useQuery({ id });
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [openField, setOpenField] = useState<FieldDef | null>(null);

  const app = q.data;

  useEffect(() => {
    if (!app || form) return;
    const initial: Record<string, string> = {};
    for (const f of NEGOCIO_FIELDS) {
      let v = "";
      if (f.key === "businessType") v = app.businessType ?? "";
      else if (f.key === "businessName") v = app.businessName ?? "";
      else v = raw(app, f.key);
      if (!v && f.type === "select" && f.options?.length) v = f.options[0].value;
      initial[f.key] = v;
    }
    setForm(initial);
  }, [app, form]);

  const update = trpc.updateApplication.useMutation({
    onSuccess: () => {
      void utils.getApplication.invalidate({ id });
      void utils.listApplications.invalidate();
      router.back();
    },
    onError: (err) => Alert.alert("Error", `No se pudo guardar. ${err.message}`)
  });

  if (q.isPending || !form) {
    return (
      <View style={styles.screen}>
        <Header title="Editar · Negocio" backMode="close" />
        <Text style={styles.centerText}>Cargando...</Text>
      </View>
    );
  }

  const name = app ? applicantName(app) : "";

  function labelFor(f: FieldDef): string {
    const v = form![f.key] ?? "";
    return f.options?.find((o) => o.value === v)?.label ?? v;
  }

  return (
    <View style={styles.screen}>
      <Header title="Editar · Negocio" subtitle={name} backMode="close" />
      <ScrollView contentContainerStyle={styles.body}>
        {NEGOCIO_FIELDS.map((f) =>
          f.type === "select" ? (
            <SelectField
              key={f.key}
              label={f.label}
              value={labelFor(f)}
              onPress={() => setOpenField(f)}
              testID={`field-${f.key}`}
            />
          ) : (
            <Input
              key={f.key}
              label={f.label}
              value={form![f.key] ?? ""}
              onChangeText={(t) => setForm((p) => ({ ...(p ?? {}), [f.key]: t }))}
              icon={f.format === "phone" ? Phone : undefined}
              keyboardType={f.format === "phone" ? "phone-pad" : "default"}
              testID={`field-${f.key}`}
            />
          )
        )}
      </ScrollView>

      <View style={styles.actionBar}>
        <BtnCta
          label={update.isPending ? "Guardando…" : "Guardar cambios"}
          icon={Check}
          color={colors.brand.blue.deep}
          disabled={update.isPending}
          onPress={() => update.mutate({ id, patch: form! })}
        />
      </View>

      <PickerModal
        visible={!!openField}
        title={openField?.label ?? ""}
        options={openField?.options ?? []}
        value={openField ? (form[openField.key] ?? "") : undefined}
        onSelect={(v) => setForm((p) => ({ ...(p ?? {}), [openField!.key]: v }))}
        onClose={() => setOpenField(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 12 },
  centerText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    paddingVertical: 40
  },
  actionBar: {
    padding: 20,
    backgroundColor: colors.brand.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light
  }
});
