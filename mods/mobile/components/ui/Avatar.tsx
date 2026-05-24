/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { View, Text, Image, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";

interface AvatarProps {
  name: string;
  imageUri?: string;
  size?: number;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function Avatar({ name, imageUri, size = 42 }: AvatarProps) {
  const borderRadius = size / 2;

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[styles.image, { width: size, height: size, borderRadius }]}
      />
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius }]}>
      <Text style={[styles.initials, { fontSize: size * 0.33 }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.brand.mist, alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: "Geist_700Bold", color: colors.brand.blue.deep },
  image: { backgroundColor: colors.brand.mist }
});
