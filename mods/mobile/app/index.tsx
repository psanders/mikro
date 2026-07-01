/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { getToken, getPin, setToken, setUserName } from "../lib/auth";
import { resolveHomeRoute } from "../lib/navigation";

const E2E = process.env.EXPO_PUBLIC_E2E === "1";
// Two well-formed (header.payload.sig) fake JWTs, distinguished only by their
// `roles` claim, so `decodeRolesFromToken`/`resolveHomeRoute` route exactly as
// they would for a real token — no backend call. EXPO_PUBLIC_E2E_ROLE picks
// which one a Maestro flow lands on (defaults to COLLECTOR, preserving the
// pre-existing e2e login-skip behavior). See .maestro/*.yaml.
const FAKE_TOKENS = {
  COLLECTOR:
    "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ0ZXN0LWNvbGxlY3RvciIsInJvbGVzIjpbIkNPTExFQ1RPUiJdfQ.e2e",
  REVIEWER:
    "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ0ZXN0LXJldmlld2VyIiwicm9sZXMiOlsiUkVWSUVXRVIiXX0.e2e"
} as const;
const E2E_ROLE = process.env.EXPO_PUBLIC_E2E_ROLE === "REVIEWER" ? "REVIEWER" : "COLLECTOR";
const FAKE_TOKEN = FAKE_TOKENS[E2E_ROLE];

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (E2E) {
        await setToken(FAKE_TOKEN);
        await setUserName("Pedro Test");
        setTarget(await resolveHomeRoute());
        return;
      }
      const token = await getToken();
      if (!token) {
        setTarget("/(auth)/login");
        return;
      }
      const pin = await getPin();
      setTarget(pin ? "/(auth)/unlock" : await resolveHomeRoute());
    })();
  }, []);

  if (!target) return null;
  return <Redirect href={target} />;
}
