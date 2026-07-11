/// <reference types="vite/client" />

/** Monorepo version baked in at build time (see vite.config.ts `define`). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Set to "1" to skip the desktop auto-updater — see lib/updater.ts. */
  readonly VITE_DISABLE_AUTO_UPDATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
