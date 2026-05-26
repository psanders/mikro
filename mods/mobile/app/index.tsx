/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { getToken, getPin, setToken, setUserName } from "../lib/auth";

const E2E = process.env.EXPO_PUBLIC_E2E === "1";
const FAKE_TOKEN = "eyJtb2NrIjp0cnVlLCJzdWIiOiJ0ZXN0LWNvbGxlY3RvciJ9";

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (E2E) {
        await setToken(FAKE_TOKEN);
        await setUserName("Pedro Test");
        setTarget("/(tabs)");
        return;
      }
      const token = await getToken();
      if (!token) {
        setTarget("/(auth)/login");
        return;
      }
      const pin = await getPin();
      setTarget(pin ? "/(auth)/unlock" : "/(tabs)");
    })();
  }, []);

  if (!target) return null;
  return <Redirect href={target} />;
}
