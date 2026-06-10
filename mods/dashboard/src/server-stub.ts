// Stub for server-only packages (@resvg/resvg-js, sharp, satori) that are
// pulled in transitively through @mikro/common report generators. The Tauri
// webview and browser bundle never execute these code paths; these stubs let
// the production build succeed and prevent runtime errors from missing exports.

// @resvg/resvg-js named exports
export class Resvg {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(_svg?: unknown, _opts?: unknown) {}
  render() {
    return { asPng: () => new Uint8Array(0) };
  }
  toString() {
    return "";
  }
}
export const renderAsync = async () => new Uint8Array(0);
export const renderSync = () => new Uint8Array(0);

// satori — default-imported SVG renderer used in report generators.
const satoriStub = async () => "<svg></svg>";
export { satoriStub as default };
