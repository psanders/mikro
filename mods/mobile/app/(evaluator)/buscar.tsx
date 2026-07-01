/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pencil `Evaluador / 03 Buscar` (p18v9z): search across applications
 * regardless of status. There's no server-side search endpoint —
 * `listApplications` without a `status` filter returns across all statuses,
 * so we fetch one broad candidate list and filter client-side (mirrors
 * `SolicitudesPage.tsx`'s substring filter). Recent-searches follow the same
 * AsyncStorage pattern/testID convention as `(tabs)/buscar.tsx`, under a
 * separate evaluator-scoped storage key.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, History, X } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../../lib/theme";
import { trpc } from "../../lib/api";
import { SolicitudRow } from "../../components/ui/SolicitudRow";
import {
  applicantName,
  isForbidden,
  riskRowLabel,
  riskRowVariant,
  timeAgo
} from "../../lib/applications";

const RECENT_KEY = "mikro:evaluator_recent_searches";
const MAX_RECENT = 4;
const RESULTS_LIMIT = 50;
const DEFAULT_LIST_SIZE = 5;

function useRecentSearches() {
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (raw) setRecents(JSON.parse(raw));
    });
  }, []);

  const add = useCallback((term: string) => {
    setRecents((prev) => {
      const next = [term, ...prev.filter((t) => t !== term)].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((term: string) => {
    setRecents((prev) => {
      const next = prev.filter((t) => t !== term);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recents, add, remove };
}

export default function EvaluadorBuscarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const { recents, add, remove } = useRecentSearches();

  const listQ = trpc.listApplications.useQuery({ limit: RESULTS_LIMIT });

  const trimmed = query.trim();
  const searchEnabled = trimmed.length >= 2;

  const filtered = useMemo(() => {
    const list = listQ.data ?? [];
    if (!searchEnabled) return list.slice(0, DEFAULT_LIST_SIZE);
    const term = trimmed.toLowerCase();
    return list.filter((a) =>
      [applicantName(a), a.businessName, a.idNumber, a.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [listQ.data, searchEnabled, trimmed]);

  function handleSelect(id: string) {
    if (trimmed) add(trimmed);
    router.push(`/solicitud/${id}`);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Buscar solicitud</Text>
        <View style={styles.searchBox}>
          <Search size={18} color={colors.brand.blue.primary} strokeWidth={2} />
          <TextInput
            testID="search-input"
            style={styles.searchInput}
            placeholder="Nombre, cédula o teléfono…"
            placeholderTextColor={colors.text.secondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <X size={18} color={colors.text.secondary} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!trimmed && recents.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>BÚSQUEDAS RECIENTES</Text>
            <View style={styles.recentList}>
              {recents.map((term) => (
                <Pressable key={term} style={styles.recentRow} onPress={() => setQuery(term)}>
                  <History size={18} color={colors.text.secondary} strokeWidth={2} />
                  <Text style={styles.recentText}>{term}</Text>
                  <Pressable onPress={() => remove(term)} hitSlop={8}>
                    <X size={18} color={colors.text.secondary} strokeWidth={2} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>
          {searchEnabled ? "RESULTADOS" : "SOLICITUDES RECIENTES"}
        </Text>

        {listQ.isPending && <Text style={styles.emptyText}>Cargando...</Text>}

        {!listQ.isPending && listQ.isError && (
          <Text style={styles.errorText}>
            {isForbidden(listQ.error)
              ? "No tienes acceso a las solicitudes. Pide a un administrador el rol de revisor."
              : "No se pudieron cargar las solicitudes."}
          </Text>
        )}

        {!listQ.isPending && !listQ.isError && searchEnabled && filtered.length === 0 && (
          <Text style={styles.emptyText}>Sin resultados para "{trimmed}"</Text>
        )}

        <View style={styles.resultsList}>
          {filtered.map((a) => (
            <SolicitudRow
              key={a.id}
              testID={`solicitud-${a.id}`}
              name={applicantName(a)}
              business={[a.businessName, a.province].filter(Boolean).join(" · ")}
              meta={`Enviada hace ${timeAgo(a.createdAt)}`}
              riskLabel={riskRowLabel(a.riskBand, a.score)}
              riskVariant={riskRowVariant(a.riskBand, a.score)}
              score={a.score ?? 0}
              onPress={() => handleSelect(a.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  header: { paddingHorizontal: 20, paddingTop: 14, gap: 12, paddingBottom: 8 },
  title: { fontFamily: "Geist_700Bold", fontSize: 24, color: colors.brand.blue.deep },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brand.mist,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16
  },
  searchInput: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 15,
    color: colors.brand.ink,
    padding: 0
  },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  sectionLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.secondary,
    paddingTop: 4,
    paddingBottom: 2
  },
  recentList: { gap: 8 },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 12
  },
  recentText: { flex: 1, fontFamily: "Geist_500Medium", fontSize: 14, color: colors.brand.ink },
  resultsList: { gap: 10 },
  emptyText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    paddingVertical: 20
  },
  errorText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.brand.orange.deep,
    textAlign: "center",
    paddingVertical: 20
  }
});
