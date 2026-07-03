/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  RefreshControl
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, History, X, ChevronRight } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../../lib/theme";
import { Avatar } from "../../components/ui/Avatar";
import { useLocalCustomerSearch } from "../../lib/offline/hooks";
import { useSyncContext } from "../../lib/offline/SyncProvider";

const RECENT_KEY = "mikro:recent_searches";
const MAX_RECENT = 4;

interface CustomerSummary {
  id: string;
  name: string;
}

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

export default function BuscarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const { recents, add, remove } = useRecentSearches();
  const { isPulling, pull } = useSyncContext();

  const trimmed = query.trim();
  const searchEnabled = trimmed.length >= 2;

  const localResult = useLocalCustomerSearch(searchEnabled ? trimmed : "", 20);

  const filtered = useMemo(() => {
    if (!searchEnabled) return [];
    return (localResult.data ?? []).map(
      (c): CustomerSummary => ({
        id: c.id,
        name: c.nickname ?? c.name
      })
    );
  }, [searchEnabled, localResult.data]);

  const handleSelect = (c: CustomerSummary) => {
    if (trimmed) add(trimmed);
    router.push(`/cliente/${c.id}`);
  };

  const handleRecentTap = (term: string) => {
    setQuery(term);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Buscar cliente</Text>
        <View style={styles.searchBox}>
          <Search size={18} color={colors.brand.blue.primary} strokeWidth={2} />
          <TextInput
            testID="search-input"
            style={styles.searchInput}
            placeholder="Nombre o teléfono…"
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

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical
        refreshControl={<RefreshControl refreshing={isPulling} onRefresh={pull} />}
      >
        {!trimmed && recents.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>BÚSQUEDAS RECIENTES</Text>
            <View style={styles.recentList}>
              {recents.map((term) => (
                <Pressable
                  key={term}
                  style={styles.recentRow}
                  onPress={() => handleRecentTap(term)}
                >
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

        {searchEnabled && localResult.isLoading && filtered.length === 0 && (
          <Text style={styles.emptyText}>Buscando...</Text>
        )}

        {searchEnabled && !localResult.isLoading && filtered.length === 0 && (
          <Text style={styles.emptyText}>Sin resultados para "{trimmed}"</Text>
        )}

        {filtered.map((c) => (
          <Pressable
            key={c.id}
            style={styles.clientRow}
            onPress={() => handleSelect(c)}
            testID={`customer-${c.id}`}
          >
            <Avatar name={c.name} size={36} />
            <View style={styles.clientMid}>
              <Text style={styles.clientName} testID={`customer-name-${c.id}`}>
                {c.name}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.text.secondary} strokeWidth={2} />
          </Pressable>
        ))}
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
  emptyText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    paddingVertical: 20
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.brand.white,
    borderRadius: 12,
    padding: 12
  },
  clientMid: { flex: 1, gap: 2 },
  clientName: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.ink }
});
