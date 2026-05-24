/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, X } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";

interface HeaderProps {
  title: string;
  subtitle?: string;
  backMode?: "back" | "close";
  rightIcon?: LucideIcon;
  onRightPress?: () => void;
}

export function Header({
  title,
  subtitle,
  backMode = "back",
  rightIcon: RightIcon,
  onRightPress
}: HeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const BackIcon = backMode === "close" ? X : ChevronLeft;

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.left}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8}>
          <BackIcon size={24} color={colors.brand.blue.deep} strokeWidth={2} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {RightIcon && (
        <Pressable onPress={onRightPress} hitSlop={8}>
          <RightIcon size={22} color={colors.brand.blue.deep} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.bg.screen
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  backBtn: { justifyContent: "center" },
  titleWrap: { gap: 2, flex: 1 },
  title: { fontFamily: "Geist_700Bold", fontSize: 20, color: colors.brand.blue.deep },
  subtitle: { fontFamily: "Geist_500Medium", fontSize: 12, color: colors.text.secondary }
});
