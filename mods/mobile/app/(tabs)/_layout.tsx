/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Tabs } from "expo-router";
import { TabBar } from "../../components/ui/TabBar";

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Hoy" }} />
      <Tabs.Screen name="ruta" options={{ title: "Ruta" }} />
      <Tabs.Screen name="buscar" options={{ title: "Buscar" }} />
      <Tabs.Screen name="cuadre" options={{ title: "Cuadre" }} />
    </Tabs>
  );
}
