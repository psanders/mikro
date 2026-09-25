/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Central flag for Maestro end-to-end builds. `EXPO_PUBLIC_E2E` is inlined into
 * the JS bundle at build time (Expo public-env convention), so it must be set
 * before building: `EXPO_PUBLIC_E2E=1 npx expo run:ios`. When set, the app
 * fakes login (see `app/index.tsx`) and serves tRPC from an in-memory fixture
 * (`e2eMockLink`) so flows run headlessly with no backend.
 */
export const IS_E2E = process.env.EXPO_PUBLIC_E2E === "1";
