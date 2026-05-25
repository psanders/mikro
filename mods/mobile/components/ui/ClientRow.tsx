/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Pressable, View, Text, StyleSheet } from "react-native";
import { Avatar } from "./Avatar";
import { colors, radii } from "../../lib/theme";

type RowVariant = "default" | "overdue" | "done";

interface ClientRowProps {
  name: string;
  business: string;
  meta: string;
  amount: string;
  amountSub?: string;
  imageUri?: string;
  variant?: RowVariant;
  onPress?: () => void;
}

const variantStyles: Record<
  RowVariant,
  { bg: string; border?: string; amountColor: string; metaColor: string }
> = {
  default: {
    bg: colors.brand.white,
    amountColor: colors.brand.blue.deep,
    metaColor: colors.text.secondary
  },
  overdue: {
    bg: "#FFEDD9",
    border: "#F2C2A4",
    amountColor: colors.brand.orange.deep,
    metaColor: "#A8521F"
  },
  done: {
    bg: colors.brand.mist,
    amountColor: colors.brand.blue.primary,
    metaColor: colors.brand.blue.primary
  }
};

export function ClientRow({
  name,
  business,
  meta,
  amount,
  amountSub,
  imageUri,
  variant = "default",
  onPress
}: ClientRowProps) {
  const v = variantStyles[variant];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        { backgroundColor: v.bg },
        v.border ? { borderWidth: 1, borderColor: v.border } : undefined
      ]}
    >
      <Avatar name={name} imageUri={imageUri} />
      <View style={styles.mid}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {business ? (
          <Text style={styles.biz} numberOfLines={1}>
            {business}
          </Text>
        ) : null}
        <Text style={[styles.meta, { color: v.metaColor }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={styles.trail}>
        <Text style={[styles.amount, { color: v.amountColor }]}>{amount}</Text>
        {amountSub && <Text style={[styles.amountSub, { color: v.amountColor }]}>{amountSub}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.card,
    padding: 14
  },
  mid: { flex: 1, gap: 2 },
  name: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.ink },
  biz: { fontFamily: "Geist_700Bold", fontSize: 11, color: colors.brand.blue.deep },
  meta: { fontFamily: "Geist_500Medium", fontSize: 12 },
  trail: { alignItems: "flex-end", gap: 2 },
  amount: { fontFamily: "Geist_700Bold", fontSize: 14 },
  amountSub: { fontFamily: "Geist_600SemiBold", fontSize: 10 }
});
