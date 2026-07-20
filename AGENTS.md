# Agent & Contributor Practices

Hard-won rules for this monorepo. Each exists because its absence broke CI
or a build. Keep entries short; link the enforcing check when one exists.

## Lockfile discipline (npm workspaces)

- **One lockfile.** All workspaces (`mods/*`, `site`) resolve through the
  root `package-lock.json`. After editing ANY workspace `package.json`, run
  `npm install` at the repo root and commit the lock change with it.
  Enforced by the "Lock file in sync" PR check (`npm ci --ignore-scripts`)
  and the `pre-push` hook (`npm ci --dry-run`).
- **The sync gate is `npm ci`, never "regenerate + git diff".** `npm ci`
  fails when a `package.json` dependency is not satisfied by the lock but
  never rewrites the lock. Do NOT reintroduce a
  `npm install --package-lock-only && git diff` gate: npm's arborist stamps
  a cosmetic `"peer": true` flag on os/cpu-gated optional binaries (esbuild,
  rolldown, @tailwindcss/oxide, …) **differently on macOS vs Linux**. The
  committed lock is generated on a contributor's Mac (flag present); a Linux
  CI runner regenerating it strips the flag, so a diff gate "fails" on pure
  noise while the lock installs cleanly — this is the flapping that plagued
  the old gate. The cosmetic churn is safe to leave in the committed lock.
- **Platform narrowing is the recurring disease.** npm installs on one
  platform can drop other platforms' prebuilt-binary entries from the lock
  (npm/cli#4828). The lock then only carries `darwin-arm64` binaries for
  packages like sharp, esbuild, rolldown, oxc, @tailwindcss/oxide,
  @tauri-apps/cli — and Linux/EAS CI breaks at install or build time.
  Enforced by the "Check lock file platform coverage" PR step
  (`.scripts/check-lockfile-platforms.mjs`). To repair:
  `rm -rf node_modules && npm install` (fresh resolution records all
  platforms). Do NOT hand-delete lock entries and re-resolve with
  `--package-lock-only` — npm trusts the remaining state and can drop
  whole subtrees (this once removed rolldown/esbuild and broke the site
  build on CI).
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
- The Docker image `ghcr.io/psanders/mikro` (private package, GitHub
  Container Registry — migrated off Docker Hub, see #51) is published
  linux/amd64 only. On Apple Silicon run it with `--platform linux/amd64`.
  publish-apiserver.yaml authenticates with the job's own `GITHUB_TOKEN`
  (`packages: write`); deploy-apiserver.yaml forwards a `packages: read`
  `GITHUB_TOKEN` over SSH so the droplet can pull the private image without
  a long-lived registry secret.
- **build-dashboard pins `macos-26`, not `macos-latest`.** The `-latest`
  label is a lottery during GitHub's macOS 15→26 migration (started
  2026-06-15), and `screencapturekit` → `apple-metal` needs the macOS 26
  SDK's Metal APIs — on a macOS 15 runner its Swift bridge fails to
  compile (`MTLSamplerReductionMode` not in scope). Keep the pin until
  the migration completes; any new macOS job that builds src-tauri needs
  the same.
- **build-dashboard's windows-latest `Install dependencies` step retries
  3x.** The runner's outbound connection to the npm registry occasionally
  resets mid-install (`ECONNRESET` / "network aborted"), unrelated to any
  dependency change — seen first on 2026-07-07 (v1.26.0 run). npm's
  built-in per-request retries don't cover a reset that kills the whole
  process, so the step wraps `npm install` in a 3-attempt shell loop.
  If it starts failing on all 3 attempts, suspect an actual dependency
  problem instead of the network.
- **`patch-package`** patches a dependency's shipped code post-install (root
  `postinstall` script, diffs in `patches/`). First and, as of 2026-07-04,
  only use: `react-native-nitro-screen-recorder`'s Expo config plugin
  unconditionally sets up an iOS BroadcastExtension target this app never
  needs (it only uses `startInAppRecording` on iOS), and building that
  extension hit an unresolved upstream EAS managed-credentials bug
  (expo/expo#40851 — provisioning profile never picks up the App Group, and
  regenerating credentials didn't fix it for other reporters either). The
  patch skips the extension entirely rather than fighting EAS to provision
  something unused. Pin the exact version of any patched package (no `^`/`~`)
  — patch-package fails loudly on a version mismatch, which is the point, but
  only if the pin actually stops an unnoticed bump first.

## Mobile build & release architecture

- **Android APK (internal):** GitHub Actions `build-android.yaml` on every
  main push touching mobile — Linux, expo prebuild + Gradle, signed with
  the debug keystore. Free and sufficient for internal distribution.
- **iOS:** `build-ios.yaml` compiles ON a `macos-26` runner with
  `eas build --local` (since 2026-07-04): EAS _cloud_ builds are rationed
  by a per-account Free-plan quota (profile choice doesn't matter) and ran
  dry mid-cycle. Local builds consume zero quota; EAS still owns Apple
  signing — `--local` pulls the same remote credentials via `EXPO_TOKEN`.
  macOS runners are free because the repo is PUBLIC; the old "no macOS
  runner ever compiles iOS" rule (10x minutes multiplier) only applies to
  private-repo billing — revisit if the repo goes private. Triggers:
  manual dispatch (profile choice, default preview) or a v\* tag
  (production; IPA attached to the Release). Unlike build-android it does
  NOT run on every main push — each run ties up a macOS runner ~40-60 min.
  JS-only changes: `eas update` (OTA, `runtimeVersion.policy: fingerprint`
  gates native compatibility).
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
- **Gradle needs more memory than the Expo template gives it.** The
  expo-updates Kotlin/KSP compile exhausts the default
  `-Xmx2048m -XX:MaxMetaspaceSize=512m` ("OutOfMemoryError: Metaspace",
  seen locally and on CI). `android/gradle.properties` is GENERATED by
  prebuild and gitignored — a local edit never reaches CI. The
  build-android workflow bumps it after prebuild; new build environments
  must do the same (≈`-Xmx5g -XX:MaxMetaspaceSize=1g`).

- **The GitHub Release is the consolidated build-outputs page.**
  release.yaml creates it (title + "Build outputs" body) right after lerna
  pushes the tag; downstream workflows only ATTACH assets to it —
  build-dashboard via tauri-action, build-android via `gh release upload`
  (it detects release commits by the v\* tag on HEAD). Deterministic links
  (Docker image, EAS builds page) live in the body release.yaml writes.
  Don't add another workflow that creates or rewrites the Release body, and
  keep new build outputs reporting into that Release.

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
- **Every schema change ships a migration.** The container boots with
  `prisma migrate deploy`, which only runs committed migrations — schema
  changes applied with `prisma db push` exist only on the DB you pushed to,
  and every fresh database (CI smoke test, new environment) breaks at
  runtime. If a database already received the change via `db push`, mark
  the reconciling migration as applied there with
  `prisma migrate resolve --applied <migration>` instead of running it.
