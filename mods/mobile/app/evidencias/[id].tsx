/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One application's evidence checklist (Pencil zcr5b / complete If9ns /
 * location states M826e7): the business location from GPS (required), the
 * cédula's two slots, business photos and optional documents. Every photo comes
 * from the camera or the gallery; each piece is saved as soon as it's taken.
 * Collectors can add, replace and remove anything while it's in review.
 */
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  CircleCheck,
  ExternalLink,
  FilePlus,
  IdCard,
  Link as LinkIcon,
  LocateFixed,
  MapPin,
  MapPinCheck,
  MapPinOff,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  RotateCcw,
  SignalLow,
  Trash2
} from "lucide-react-native";
import { buildMapUrl } from "@mikro/common/schemas";
import { colors } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { trpc } from "../../lib/api";
import {
  captureLocation,
  inReviewLabel,
  missingPieces,
  pickImage,
  type PhotoSource,
  type Reading
} from "../../lib/evidence";

const SUGGESTED_PHOTOS = ["Fachada", "Interior", "Mercancía"];

type LocState =
  | { kind: "idle" }
  | { kind: "searching"; best: Reading | null }
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "weak"; reading: Reading };

/** Ask where the photo comes from; resolves null on cancel. */
function chooseSource(title: string): Promise<PhotoSource | null> {
  return new Promise((resolve) => {
    Alert.alert(title, undefined, [
      { text: "Cámara", onPress: () => resolve("camera") },
      { text: "Galería", onPress: () => resolve("library") },
      { text: "Cancelar", style: "cancel", onPress: () => resolve(null) }
    ]);
  });
}

export default function EvidenciaDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const task = trpc.getEvidenceTask.useQuery({ id: id! }, { enabled: Boolean(id) });
  const [busy, setBusy] = useState<string | null>(null);
  const [loc, setLoc] = useState<LocState>({ kind: "idle" });

  const uploadId = trpc.uploadIdImage.useMutation();
  const deleteId = trpc.deleteIdImage.useMutation();
  const uploadDoc = trpc.uploadApplicationDocument.useMutation();
  const deleteDoc = trpc.deleteApplicationDocument.useMutation();
  const setMapUrl = trpc.setApplicationMapUrl.useMutation();

  async function run(key: string, work: () => Promise<unknown>) {
    setBusy(key);
    try {
      await work();
    } catch (e) {
      Alert.alert("No se pudo guardar", (e as Error).message || "Intenta de nuevo.");
    } finally {
      setBusy(null);
      await Promise.all([
        utils.getEvidenceTask.invalidate({ id: id! }),
        utils.listEvidenceQueue.invalidate()
      ]);
    }
  }

  async function addIdSide(side: "FRONT" | "BACK") {
    const source = await chooseSource(side === "FRONT" ? "Cédula · frente" : "Cédula · reverso");
    if (!source) return;
    const img = await pickImage(source);
    if (!img) return;
    await run(`id-${side}`, () => uploadId.mutateAsync({ id: id!, side, ...img }));
  }

  async function addPhoto(label?: string) {
    const source = await chooseSource(label ? `Foto · ${label}` : "Foto del negocio");
    if (!source) return;
    const img = await pickImage(source);
    if (!img) return;
    await run(`photo-${label ?? "extra"}`, () =>
      uploadDoc.mutateAsync({ id: id!, kind: "BUSINESS_PHOTO", label, ...img })
    );
  }

  async function addOther() {
    const source = await chooseSource("Otro documento");
    if (!source) return;
    const img = await pickImage(source);
    if (!img) return;
    await run("other", () =>
      uploadDoc.mutateAsync({ id: id!, kind: "OTHER", label: img.originalName, ...img })
    );
  }

  function confirmRemove(what: string, work: () => Promise<unknown>) {
    Alert.alert(`¿Quitar ${what}?`, undefined, [
      { text: "Cancelar", style: "cancel" },
      { text: "Quitar", style: "destructive", onPress: () => void run("remove", work) }
    ]);
  }

  async function saveReading(reading: Reading) {
    await run("location", () =>
      setMapUrl.mutateAsync({ id: id!, mapUrl: buildMapUrl(reading.latitude, reading.longitude) })
    );
    setLoc({ kind: "idle" });
  }

  async function startCapture() {
    setLoc({ kind: "searching", best: null });
    const result = await captureLocation((best) => setLoc({ kind: "searching", best }));
    if (result.kind === "good") await saveReading(result.reading);
    else if (result.kind === "weak") setLoc({ kind: "weak", reading: result.reading });
    else setLoc({ kind: result.kind });
  }

  const t = task.data;
  if (!t) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Header title="Evidencia" fallbackRoute="/evidencias" />
        <Text style={[styles.muted, { padding: 20 }]}>
          {task.isError ? "Esta solicitud ya no está en evaluación." : "Cargando…"}
        </Text>
      </View>
    );
  }

  const name = [t.firstName, t.lastName].filter(Boolean).join(" ") || "Solicitud";
  const missing = missingPieces(t.status);
  const photos = t.documents.filter((d) => d.kind === "BUSINESS_PHOTO");
  const others = t.documents.filter((d) => d.kind === "OTHER");
  const openSlots = SUGGESTED_PHOTOS.filter((l) => !photos.some((p) => p.label === l)).slice(
    0,
    Math.max(0, t.status.businessPhotos.need - photos.length)
  );
  const digits = (t.phone ?? "").replace(/\D/g, "");
  const address = [t.homeAddress, t.province?.replace(/_/g, " ")].filter(Boolean).join(", ");

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header
        title={t.businessName ?? name}
        subtitle={`${name} · ${inReviewLabel(t.inReviewSince).toLowerCase()}`}
        rightIcon={digits ? Phone : undefined}
        onRightPress={() => digits && Linking.openURL(`tel:${digits}`)}
        fallbackRoute="/evidencias"
      />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}>
        {t.status.complete && (
          <View style={styles.doneBanner} testID="evidence-complete">
            <CircleCheck size={20} color={colors.status.success} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.doneTitle}>Evidencia completa</Text>
              <Text style={styles.doneText}>
                El revisor ya puede enviarla a decisión. Puedes corregir cualquier foto hasta
                entonces.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.addrRow}>
            <MapPin size={18} color={colors.brand.blue.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.street}>{t.homeAddress ?? "Sin dirección"}</Text>
              <Text style={styles.muted}>
                {[t.province?.replace(/_/g, " "), t.addressReference].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <ActionBtn
              icon={Phone}
              label="Llamar"
              onPress={() => digits && Linking.openURL(`tel:${digits}`)}
            />
            <ActionBtn
              icon={MessageCircle}
              label="WhatsApp"
              onPress={() =>
                digits &&
                Linking.openURL(`https://wa.me/${digits.startsWith("1") ? digits : `1${digits}`}`)
              }
            />
            <ActionBtn
              icon={Navigation}
              label="Cómo llegar"
              onPress={() =>
                address &&
                Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                )
              }
            />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <View style={styles.progHead}>
            <Text style={styles.progLabel}>
              {t.progress.have} de {t.progress.need} recogidas
            </Text>
            <Text
              style={[styles.progMissing, t.status.complete && { color: colors.status.success }]}
            >
              {t.status.complete ? "Completa" : `Faltan ${t.progress.need - t.progress.have}`}
            </Text>
          </View>
          <ProgressBar
            progress={t.progress.need ? t.progress.have / t.progress.need : 0}
            color={t.status.complete ? colors.status.success : colors.brand.orange.primary}
          />
          {missing.length > 0 && <Text style={styles.muted}>Falta: {missing.join(" · ")}</Text>}
        </View>

        <SectionHead
          label="UBICACIÓN DEL NEGOCIO"
          right={t.mapUrl ? "GUARDADA" : "OBLIGATORIA"}
          ok={Boolean(t.mapUrl)}
        />
        {t.mapUrl && loc.kind === "idle" ? (
          <View style={styles.card} testID="location-saved">
            <View style={styles.locRow}>
              <IconTile
                icon={MapPinCheck}
                bg={colors.status.successBg}
                fg={colors.status.success}
              />
              <Text style={styles.locTitle}>Ubicación guardada</Text>
            </View>
            <View style={styles.linkRow}>
              <LinkIcon size={14} color={colors.brand.blue.primary} />
              <Text style={styles.link} numberOfLines={1}>
                {t.mapUrl.replace(/^https:\/\//, "")}
              </Text>
            </View>
            <View style={styles.inlineActions}>
              <InlineAction
                icon={ExternalLink}
                label="Abrir en Maps"
                onPress={() => Linking.openURL(t.mapUrl!)}
              />
              <InlineAction icon={RotateCcw} label="Volver a tomar" onPress={startCapture} />
            </View>
          </View>
        ) : (
          <LocationCard
            state={loc}
            busy={busy === "location"}
            onStart={startCapture}
            onSaveAnyway={(r) => void saveReading(r)}
          />
        )}

        <SectionHead
          label="CÉDULA"
          right={`${Number(t.idFront) + Number(t.idBack)} de 2`}
          ok={t.idFront && t.idBack}
        />
        <View style={styles.slots}>
          {(["FRONT", "BACK"] as const).map((side) => {
            const present = side === "FRONT" ? t.idFront : t.idBack;
            const label = side === "FRONT" ? "Frente" : "Reverso";
            return (
              <Slot
                key={side}
                label={label}
                present={present}
                icon={IdCard}
                busy={busy === `id-${side}`}
                testID={`id-slot-${side.toLowerCase()}`}
                onAdd={() => void addIdSide(side)}
                onRemove={() =>
                  confirmRemove(`la cédula (${label.toLowerCase()})`, () =>
                    deleteId.mutateAsync({ id: id!, side })
                  )
                }
              />
            );
          })}
        </View>

        <SectionHead
          label="FOTOS DEL NEGOCIO"
          right={`${photos.length} de ${t.status.businessPhotos.need} mínimo`}
          ok={photos.length >= t.status.businessPhotos.need}
        />
        <View style={styles.photoGrid}>
          {photos.map((p) => (
            <Slot
              key={p.id}
              label={p.label ?? "Foto"}
              present
              icon={Camera}
              busy={false}
              onRemove={() =>
                confirmRemove(`la foto «${p.label ?? "Foto"}»`, () =>
                  deleteDoc.mutateAsync({ documentId: p.id })
                )
              }
            />
          ))}
          {openSlots.map((l) => (
            <Slot
              key={l}
              label={l}
              present={false}
              icon={Camera}
              busy={busy === `photo-${l}`}
              testID={`photo-slot-${l}`}
              onAdd={() => void addPhoto(l)}
            />
          ))}
        </View>
        <Pressable style={styles.addMore} onPress={() => void addPhoto()} disabled={Boolean(busy)}>
          <Plus size={14} color={colors.brand.blue.primary} />
          <Text style={styles.addMoreText}>Agregar otra foto (letrero, caja…)</Text>
        </Pressable>

        <SectionHead label="OTROS DOCUMENTOS" right="OPCIONAL" />
        {others.map((d) => (
          <View key={d.id} style={styles.docRow}>
            <FilePlus size={16} color={colors.text.secondary} />
            <Text style={styles.docLabel} numberOfLines={1}>
              {d.label ?? d.originalName}
            </Text>
            <Pressable
              hitSlop={8}
              onPress={() =>
                confirmRemove("el documento", () => deleteDoc.mutateAsync({ documentId: d.id }))
              }
            >
              <Trash2 size={15} color={colors.text.secondary} />
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.docRow} onPress={() => void addOther()} disabled={Boolean(busy)}>
          <FilePlus size={16} color={colors.text.secondary} />
          <Text style={styles.docLabel}>Recibo de luz, alquiler, RNC…</Text>
          <Text style={styles.docAction}>{busy === "other" ? "Subiendo…" : "Agregar"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function LocationCard({
  state,
  busy,
  onStart,
  onSaveAnyway
}: {
  state: LocState;
  busy: boolean;
  onStart: () => void;
  onSaveAnyway: (r: Reading) => void;
}) {
  const accuracy = (r: Reading | null) =>
    r?.accuracy != null ? `±${Math.round(r.accuracy)} m` : "sin dato de precisión";
  let icon = LocateFixed;
  let bg = "#FFF1E3";
  let fg: string = colors.brand.orange.deep;
  let text = "Cuando estés frente al negocio, guarda su ubicación. Se guarda como enlace de mapa.";
  let cta: { label: string; color: string; onPress: () => void; disabled?: boolean } = {
    label: "Estoy en el negocio",
    color: colors.brand.orange.primary,
    onPress: onStart
  };
  let secondary: { label: string; onPress: () => void } | null = null;

  if (state.kind === "searching") {
    icon = LocateFixed;
    bg = colors.brand.mist;
    fg = colors.brand.blue.primary;
    text = `Obteniendo tu posición… ${state.best ? `precisión ${accuracy(state.best)}` : ""}`;
    cta = { label: "Buscando GPS…", color: "#9AB3D9", onPress: () => {}, disabled: true };
  } else if (state.kind === "denied") {
    icon = MapPinOff;
    bg = colors.status.dangerBg;
    fg = colors.status.danger;
    text = "Mikro necesita tu ubicación para guardar dónde está el negocio.";
    cta = {
      label: "Permitir ubicación",
      color: colors.brand.blue.deep,
      onPress: () => Linking.openSettings()
    };
    secondary = { label: "Intentar de nuevo", onPress: onStart };
  } else if (state.kind === "unavailable") {
    icon = MapPinOff;
    bg = colors.status.warningBg;
    fg = colors.status.warning;
    text = "No se pudo obtener la ubicación. Revisa que el GPS esté encendido.";
    cta = { label: "Intentar de nuevo", color: colors.brand.blue.deep, onPress: onStart };
  } else if (state.kind === "weak") {
    icon = SignalLow;
    bg = colors.status.warningBg;
    fg = colors.status.warning;
    text = `Precisión ${accuracy(state.reading)}. Sal a la calle o espera unos segundos. Si guardas así, solo se guarda el enlace.`;
    cta = {
      label: "Guardar de todos modos",
      color: colors.brand.blue.deep,
      onPress: () => onSaveAnyway(state.reading)
    };
    secondary = { label: "Intentar de nuevo", onPress: onStart };
  }

  return (
    <View style={[styles.card, styles.locCard]} testID={`location-${state.kind}`}>
      <View style={styles.locRow}>
        <IconTile icon={icon} bg={bg} fg={fg} />
        <Text style={styles.locText}>{text}</Text>
      </View>
      <Pressable
        onPress={cta.onPress}
        disabled={cta.disabled || busy}
        style={[styles.cta, { backgroundColor: cta.color }]}
        testID="location-cta"
      >
        {state.kind === "searching" || busy ? (
          <ActivityIndicator color={colors.brand.white} />
        ) : (
          <Text style={styles.ctaText}>{cta.label}</Text>
        )}
      </Pressable>
      {secondary && (
        <Pressable onPress={secondary.onPress} style={styles.secondary}>
          <Text style={styles.secondaryText}>{secondary.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Slot({
  label,
  present,
  icon: Icon,
  busy,
  testID,
  onAdd,
  onRemove
}: {
  label: string;
  present: boolean;
  icon: typeof Camera;
  busy: boolean;
  testID?: string;
  onAdd?: () => void;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.slot}>
      <Pressable
        testID={testID}
        onPress={present ? undefined : onAdd}
        style={[styles.slotBox, present ? styles.slotDone : styles.slotEmpty]}
      >
        {busy ? (
          <ActivityIndicator color={colors.brand.blue.primary} />
        ) : present ? (
          <>
            <Icon size={26} color={colors.brand.white} />
            <View style={styles.savedPill}>
              <CircleCheck size={11} color={colors.status.success} />
              <Text style={styles.savedText}>Guardada</Text>
            </View>
          </>
        ) : (
          <>
            <Camera size={22} color={colors.brand.blue.primary} />
            <Text style={styles.slotCta}>Cámara o galería</Text>
          </>
        )}
      </Pressable>
      <View style={styles.slotFoot}>
        <Text style={styles.slotLabel} numberOfLines={1}>
          {label}
        </Text>
        {present && onRemove && (
          <Pressable hitSlop={8} onPress={onRemove}>
            <Trash2 size={13} color={colors.text.secondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function SectionHead({ label, right, ok }: { label: string; right: string; ok?: boolean }) {
  return (
    <View style={styles.secHead}>
      <Text style={styles.secLabel}>{label}</Text>
      <Text
        style={[
          styles.secRight,
          ok === true && { color: colors.status.success },
          ok === false && { color: colors.brand.orange.deep }
        ]}
      >
        {right}
      </Text>
    </View>
  );
}

function IconTile({ icon: Icon, bg, fg }: { icon: typeof Camera; bg: string; fg: string }) {
  return (
    <View style={[styles.iconTile, { backgroundColor: bg }]}>
      <Icon size={20} color={fg} />
    </View>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onPress
}: {
  icon: typeof Camera;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <Icon size={15} color={colors.brand.blue.deep} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function InlineAction({
  icon: Icon,
  label,
  onPress
}: {
  icon: typeof Camera;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.inlineAction} onPress={onPress}>
      <Icon size={13} color={colors.brand.blue.deep} />
      <Text style={styles.inlineText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  body: { paddingHorizontal: 20, paddingTop: 4, gap: 16 },
  muted: { fontFamily: "Geist_400Regular", fontSize: 12, color: colors.text.secondary },
  card: { backgroundColor: colors.brand.white, borderRadius: 16, padding: 16, gap: 12 },
  locCard: { borderWidth: 1.5, borderColor: "#FCD9B6" },
  addrRow: { flexDirection: "row", gap: 10 },
  street: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.ink },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.brand.mist
  },
  actionText: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.blue.deep },
  doneBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.status.successBg
  },
  doneTitle: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.status.success },
  doneText: { fontFamily: "Geist_400Regular", fontSize: 12, lineHeight: 16, color: "#166534" },
  progHead: { flexDirection: "row", justifyContent: "space-between" },
  progLabel: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.ink },
  progMissing: { fontFamily: "Geist_700Bold", fontSize: 12, color: colors.brand.orange.deep },
  secHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  secLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.text.secondary
  },
  secRight: { fontFamily: "Geist_700Bold", fontSize: 11, color: colors.text.secondary },
  locRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  locTitle: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.ink },
  locText: {
    flex: 1,
    fontFamily: "Geist_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.brand.ink
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.brand.mist
  },
  link: {
    flex: 1,
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    color: colors.brand.blue.primary
  },
  inlineActions: { flexDirection: "row", gap: 16 },
  inlineAction: { flexDirection: "row", alignItems: "center", gap: 5 },
  inlineText: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.blue.deep },
  cta: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: "Geist_700Bold", fontSize: 16, color: colors.brand.white },
  secondary: { alignItems: "center", paddingVertical: 4 },
  secondaryText: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.blue.deep },
  slots: { flexDirection: "row", gap: 12 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slot: { flexGrow: 1, flexBasis: "30%", minWidth: 100, gap: 8 },
  slotBox: {
    height: 104,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  slotEmpty: { backgroundColor: "#F8FBFF", borderWidth: 1.5, borderColor: "#B9CBE6" },
  slotDone: { backgroundColor: colors.brand.blue.primary },
  slotCta: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.blue.primary },
  savedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 9999,
    backgroundColor: colors.status.successBg
  },
  savedText: { fontFamily: "Geist_700Bold", fontSize: 11, color: colors.status.success },
  slotFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  slotLabel: { flex: 1, fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.ink },
  addMore: { flexDirection: "row", alignItems: "center", gap: 6 },
  addMoreText: { fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.brand.blue.primary },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.brand.white
  },
  docLabel: { flex: 1, fontFamily: "Geist_500Medium", fontSize: 13, color: colors.brand.ink },
  docAction: { fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.brand.blue.primary }
});
