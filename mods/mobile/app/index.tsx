/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { getToken, getPin, setToken, setPin, setUserName } from "../lib/auth";

const E2E = process.env.EXPO_PUBLIC_E2E === "1";
const FAKE_TOKEN = "eyJtb2NrIjp0cnVlLCJzdWIiOiJ0ZXN0LWNvbGxlY3RvciJ9";

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (E2E) {
        await setToken(FAKE_TOKEN);
        await setPin("1234");
        await setUserName("Pedro Test");
        setTarget("/(auth)/unlock");
        return;
      }
      const token = await getToken();
      const pin = await getPin();
      if (token && pin) {
        setTarget("/(auth)/unlock");
      } else {
        setTarget("/(auth)/login");
      }
    })();
  }, []);

  if (!target) return null;
  return <Redirect href={target} />;
}
