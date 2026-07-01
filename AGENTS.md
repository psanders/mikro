# Agent & Contributor Practices

Hard-won rules for this monorepo. Each exists because its absence broke CI
or a build. Keep entries short; link the enforcing check when one exists.

## Lockfile discipline (npm workspaces)

- **One lockfile.** All workspaces (`mods/*`, `site`) resolve through the
  root `package-lock.json`. After editing ANY workspace `package.json`, run
  `npm install` at the repo root and commit the lock change with it.
  Enforced by the "Lock file in sync" PR check.
- **Platform narrowing is the recurring disease.** npm installs on one
  platform can drop other platforms' prebuilt-binary entries from the lock
  (npm/cli#4828). The lock then only carries `darwin-arm64` binaries for
  packages like sharp, esbuild, rolldown, oxc, @tailwindcss/oxide,
  @tauri-apps/cli — and Linux/EAS CI breaks at install or build time.
  Enforced by the "Check lock file platform coverage" PR step
  (`.scripts/check-lockfile-platforms.mjs`). To repair: delete the narrowed
  package's entries (parent + platform children) from `package-lock.json`,
  then `npm install --package-lock-only --ignore-scripts`.
- **Never regenerate the lockfile from scratch** (`rm package-lock.json &&
npm install`) as a "fix". It rewrites resolution monorepo-wide and hides
  the actual change in thousands of diff lines.
- **Treat `npx expo install --fix` output as a diff to review, not a
  result.** It rewrites shared devDependencies (it once swept `typescript`
  to a new major across workspaces). After running it, `git diff` every
  package.json and revert anything unrelated to Expo SDK alignment.

## Native / prebuilt-binary dependencies

- Prefer pure-JS packages. Every native dep (sharp, better-sqlite3, …)
  multiplies CI surface: per-platform binaries in the lock, per-image
  build toolchains, per-arch Docker manifests.
- **sharp on EAS:** the EAS macOS image ships a global libvips, which makes
  sharp compile from source and fail. All `eas.json` build profiles set
  `SHARP_IGNORE_GLOBAL_LIBVIPS=1` to force the prebuilt binary. Keep that
  env in any new profile.
- The Docker image `psanders/mikro` is published linux/amd64 only. On
  Apple Silicon run it with `--platform linux/amd64`.

## Mobile build & release architecture

- **Android APK (internal):** GitHub Actions `build-android.yaml` on every
  main push touching mobile — Linux, expo prebuild + Gradle, signed with
  the debug keystore. Free and sufficient for internal distribution.
- **iOS:** there is deliberately NO GitHub Actions iOS build. macOS runners
  cost a 10x minutes multiplier and installable IPAs need Apple signing
  that EAS already manages. Native iOS binaries: `eas build --platform ios`
  (TestFlight after Apple approval). JS-only changes: `eas update` (OTA,
  `runtimeVersion.policy: fingerprint` gates native compatibility).
- **What PRs check instead** (`pr-checks.yaml` → mobile-checks): mobile
  typecheck, Jest, and `expo prebuild --platform all --no-install`, which
  resolves every config plugin on Linux and catches broken native config
  before any expensive build. (A plugin entry for a package that ships no
  config plugin — e.g. expo-print — crashes prebuild and once crashed the
  app at startup.)
- **App IDs differ per platform:** iOS bundle id is `do.mikro.app`; Android
  applicationId is `do_.mikro.app` because `do` is a Java keyword and expo
  prebuild sanitizes it. Maestro flows take `APP_ID` (default iOS); Android
  CI passes `-e APP_ID=do_.mikro.app`. Anything else that addresses the app
  by id (adb commands, deep links) must respect this split.
- Local EAS builds (`--local`) with the fingerprint runtime policy need a
  clean git tree, or the fingerprint won't match what EAS computed and the
  expo-updates configure phase fails. Prefer cloud builds for release
  artifacts.

## Deploy & smoke-test contracts

- The apiserver container requires the receipt-signing keypair at boot
  (`keys/private.pem` + `keys/public.pem`, RSA-2048). Any environment that
  boots the image (CI smoke test, droplet, local docker) must mount them;
  the deploy-apiserver smoke test generates a throwaway pair with openssl.
  If boot requirements grow, update that smoke step in the same PR.
- Droplet deploys (deploy-apiserver, build-dashboard publish-updates) SSH
  with `secrets.DEPLOY_SSH_KEY` as `secrets.DEPLOY_SSH_USER`. If auth fails
  (`Permission denied (publickey)`), the fix is on the droplet
  (`~/.ssh/authorized_keys`) or in the repo secret — not in the workflow.
