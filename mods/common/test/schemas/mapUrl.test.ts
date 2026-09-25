/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { buildMapUrl, isMapUrl } from "../../src/schemas/mapUrl.js";
import { setApplicationMapUrlSchema } from "../../src/schemas/application.js";

describe("isMapUrl", () => {
  it("accepts https Google Maps links, long and short", () => {
    for (const url of [
      "https://maps.google.com/?q=19.793412,-70.688401",
      "https://www.google.com/maps/place/Puerto+Plata/@19.79,-70.69,15z",
      "https://google.com/maps?q=19.79,-70.69",
      "https://maps.app.goo.gl/AbC123xyz",
      "https://goo.gl/maps/AbC123"
    ]) {
      expect(isMapUrl(url), url).to.equal(true);
    }
  });

  it("rejects other hosts, plain http, non-map google paths and junk", () => {
    for (const url of [
      "http://maps.google.com/?q=1,2",
      "https://example.com/maps?q=1,2",
      "https://maps.google.com.evil.com/?q=1,2",
      "https://www.google.com/search?q=colmado",
      "https://goo.gl/AbC123",
      "maps.google.com/?q=1,2",
      "not a url",
      "https://maps.google.com/?q=" + "1".repeat(500)
    ]) {
      expect(isMapUrl(url), url).to.equal(false);
    }
  });
});

describe("buildMapUrl", () => {
  it("builds the GPS link with 6 decimals, and it validates", () => {
    const url = buildMapUrl(19.7934123456, -70.68840149);
    expect(url).to.equal("https://maps.google.com/?q=19.793412,-70.688401");
    expect(isMapUrl(url)).to.equal(true);
  });
});

describe("setApplicationMapUrlSchema", () => {
  it("accepts a link or null, and rejects a non-map link", () => {
    expect(
      setApplicationMapUrlSchema.safeParse({ id: "a", mapUrl: "https://maps.app.goo.gl/x" }).success
    ).to.equal(true);
    expect(setApplicationMapUrlSchema.safeParse({ id: "a", mapUrl: null }).success).to.equal(true);
    expect(
      setApplicationMapUrlSchema.safeParse({ id: "a", mapUrl: "https://example.com" }).success
    ).to.equal(false);
  });
});
