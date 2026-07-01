/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";
import { House, Map, Search, Calculator } from "lucide-react-native";
import { colors } from "../../lib/theme";

export const COLLECTOR_TAB_ICONS: Record<string, LucideIcon> = {
  index: House,
  ruta: Map,
  buscar: Search,
  cuadre: Calculator
};

interface TabBarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptors: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigation: any;
  /** Route name -> icon. Defaults to the collector tab bar's icon set. */
  icons?: Record<string, LucideIcon>;
}

export function TabBar({
  state,
  descriptors,
  navigation,
  icons = COLLECTOR_TAB_ICONS
}: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route: { key: string; name: string; params?: object }, index: number) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const isFocused = state.index === index;
        const Icon = icons[route.name] ?? House;
        const tint = isFocused ? colors.brand.blue.deep : "#7888A8";

        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : undefined}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            style={styles.tab}
          >
            <Icon size={22} color={tint} strokeWidth={2} />
            <Text style={[styles.label, { color: tint, fontWeight: isFocused ? "600" : "500" }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.brand.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: 12,
    paddingHorizontal: 32
  },
  tab: {
    alignItems: "center",
    gap: 2
  },
  label: {
    fontFamily: "Geist_500Medium",
    fontSize: 11
  }
});
