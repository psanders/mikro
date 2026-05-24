/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { getToken, getPin } from "../lib/auth";

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
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
