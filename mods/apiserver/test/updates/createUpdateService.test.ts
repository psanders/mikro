/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import {
  createGetManifestPath,
  createResolveAssetPath
} from "../../src/updates/createUpdateService.js";

describe("update file service", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "mikro-updates-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const config = () => ({ updatesDir: dir, manifestFilename: "latest.json" });

  describe("createGetManifestPath", () => {
    it("returns the manifest path when present", () => {
      writeFileSync(path.join(dir, "latest.json"), "{}");
      expect(createGetManifestPath(config())()).to.equal(path.join(dir, "latest.json"));
    });

    it("returns null when the manifest is absent", () => {
      expect(createGetManifestPath(config())()).to.equal(null);
    });
  });

  describe("createResolveAssetPath", () => {
    it("resolves a plain filename that exists in the folder", () => {
      writeFileSync(path.join(dir, "Mikro_universal.app.tar.gz"), "bytes");
      const resolve = createResolveAssetPath(config());
      expect(resolve("Mikro_universal.app.tar.gz")).to.equal(
        path.join(dir, "Mikro_universal.app.tar.gz")
      );
    });

    it("returns null for a missing file", () => {
      expect(createResolveAssetPath(config())("nope.zip")).to.equal(null);
    });

    it("rejects path traversal attempts", () => {
      // Even if the parent has a sensitive file, traversal must not resolve.
      writeFileSync(path.join(dir, "..", "secret.txt"), "secret");
      const resolve = createResolveAssetPath(config());
      expect(resolve("../secret.txt")).to.equal(null);
      expect(resolve("../../etc/passwd")).to.equal(null);
      rmSync(path.join(dir, "..", "secret.txt"), { force: true });
    });

    it("rejects nested segments and absolute paths", () => {
      const resolve = createResolveAssetPath(config());
      expect(resolve("sub/dir/file.zip")).to.equal(null);
      expect(resolve("/etc/passwd")).to.equal(null);
      expect(resolve("")).to.equal(null);
    });
  });
});
