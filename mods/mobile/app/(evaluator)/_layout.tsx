/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Tabs } from "expo-router";
import { House, ListChecks, History, Search } from "lucide-react-native";
import { TabBar } from "../../components/ui/TabBar";

const EVALUATOR_TAB_ICONS = {
  index: House,
  cola: ListChecks,
  historial: History,
  buscar: Search
};

export default function EvaluatorTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} icons={EVALUATOR_TAB_ICONS} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="cola" options={{ title: "Cola" }} />
      <Tabs.Screen name="historial" options={{ title: "Historial" }} />
      <Tabs.Screen name="buscar" options={{ title: "Buscar" }} />
    </Tabs>
  );
}
