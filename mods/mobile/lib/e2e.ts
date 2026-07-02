/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Central flag for Maestro end-to-end builds. `EXPO_PUBLIC_E2E` is inlined into
 * the JS bundle at build time (Expo public-env convention), so it must be set
 * before building: `EXPO_PUBLIC_E2E=1 EXPO_PUBLIC_E2E_ROLE=REVIEWER npx expo
 * run:ios`. When set, the app fakes login (see `app/index.tsx`), serves tRPC
 * from an in-memory fixture (`e2eMockLink`), and stubs the camera
 * (`contractPhoto`) so flows run headlessly with no backend or native camera.
 */
export const IS_E2E = process.env.EXPO_PUBLIC_E2E === "1";
