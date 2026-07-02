/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reusable "tap-a-section-to-edit" screen for the Evaluador flow, backing the
 * per-section edit routes (Solicitante `Il9kN`, Crédito `B1vT4`, Referencias
 * `FC6R3`, Vivienda `udAwm`). Mirrors `editar-negocio.tsx`: prefilled from the
 * application's `rawData` display strings, saved via `updateApplication`
 * (id + patch), which merges the patch over rawData and re-scores server-side.
 * Cédula/phone fields are masked and block save while incomplete, matching the
 * desktop edit modal. (Negocio keeps its own screen since it reads a couple of
 * fields from typed columns.)
 */
import { useEffect, useState } from "react";
import { Alert, View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Phone, Calendar } from "lucide-react-native";
import { colors } from "../lib/theme";
import { trpc } from "../lib/api";
import { Header } from "./ui/Header";
import { Input } from "./ui/Input";
import { SelectField } from "./ui/SelectField";
import { PickerModal } from "./ui/PickerModal";
import { BtnCta } from "./ui/BtnCta";
import type { FieldDef } from "../lib/applicationFields";
import { applicantName } from "../lib/applications";
import { applyFormat, formatError } from "../lib/inputFormat";

function raw(app: { rawData?: unknown } | undefined, key: string): string {
  const v = (app?.rawData as Record<string, unknown> | null | undefined)?.[key];
  return typeof v === "string" && v.trim() ? v : "";
}

interface SolicitudSectionEditProps {
  title: string;
  fields: FieldDef[];
}

export function SolicitudSectionEdit({ title, fields }: SolicitudSectionEditProps) {
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
    for (const f of fields) {
      let v = raw(app, f.key);
      if (v && f.format) v = applyFormat(f.format, v);
      if (!v && f.type === "select" && f.options?.length) v = f.options[0].value;
      initial[f.key] = v;
    }
    setForm(initial);
  }, [app, form, fields]);

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
        <Header title={title} backMode="close" />
        <Text style={styles.centerText}>Cargando...</Text>
      </View>
    );
  }

  const name = app ? applicantName(app) : "";

  // Block save while any masked field holds a partial (invalid) value.
  const hasErrors = fields.some((f) => f.format && formatError(f.format, form[f.key] ?? ""));

  function labelFor(f: FieldDef): string {
    const v = form![f.key] ?? "";
    return f.options?.find((o) => o.value === v)?.label ?? v;
  }

  const setField = (f: FieldDef, t: string) =>
    setForm((p) => ({ ...(p ?? {}), [f.key]: f.format ? applyFormat(f.format, t) : t }));

  return (
    <View style={styles.screen}>
      <Header title={title} subtitle={name} backMode="close" />
      <ScrollView contentContainerStyle={styles.body}>
        {fields.map((f) => {
          if (f.type === "select") {
            return (
              <SelectField
                key={f.key}
                label={f.label}
                value={labelFor(f)}
                onPress={() => setOpenField(f)}
                testID={`field-${f.key}`}
              />
            );
          }
          const err = f.format ? formatError(f.format, form![f.key] ?? "") : null;
          return (
            <View key={f.key} style={styles.field}>
              <Input
                label={f.label}
                value={form![f.key] ?? ""}
                onChangeText={(t) => setField(f, t)}
                placeholder={f.type === "date" ? "AAAA-MM-DD" : undefined}
                icon={f.format === "phone" ? Phone : f.type === "date" ? Calendar : undefined}
                keyboardType={f.format ? "phone-pad" : "default"}
                testID={`field-${f.key}`}
              />
              {err ? <Text style={styles.error}>{err}</Text> : null}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.actionBar}>
        <BtnCta
          label={update.isPending ? "Guardando…" : "Guardar cambios"}
          icon={Check}
          color={colors.brand.blue.deep}
          disabled={update.isPending || !!hasErrors}
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
  field: { gap: 4, width: "100%" },
  error: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.status.danger },
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
