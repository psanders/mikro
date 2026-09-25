/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  betterReading,
  imageMimeType,
  inReviewLabel,
  isGoodReading,
  missingPieces,
  type Reading
} from "../evidence";

const at = (accuracy: number | null): Reading => ({ latitude: 19.79, longitude: -70.69, accuracy });

describe("GPS readings", () => {
  it("keeps the more accurate reading, and prefers a known accuracy", () => {
    expect(betterReading(null, at(50))).toEqual(at(50));
    expect(betterReading(at(50), at(12))).toEqual(at(12));
    expect(betterReading(at(12), at(50))).toEqual(at(12));
    expect(betterReading(at(null), at(80))).toEqual(at(80));
    expect(betterReading(at(80), at(null))).toEqual(at(80));
  });

  it("20 m or better is good enough to save without asking", () => {
    expect(isGoodReading(at(20))).toBe(true);
    expect(isGoodReading(at(21))).toBe(false);
    expect(isGoodReading(at(null))).toBe(false);
  });
});

describe("imageMimeType", () => {
  it("uses the reported type or the extension, defaulting to JPEG", () => {
    expect(imageMimeType("file:///a.png")).toBe("image/png");
    expect(imageMimeType("file:///a", "image/webp")).toBe("image/webp");
    expect(imageMimeType("file:///a.heic", "image/heic")).toBe("image/jpeg");
    expect(imageMimeType("file:///camera.jpg")).toBe("image/jpeg");
  });
});

describe("inReviewLabel", () => {
  const now = new Date(2026, 8, 25, 10);
  it("says today, yesterday or N days", () => {
    expect(inReviewLabel(new Date(2026, 8, 25, 8), now)).toBe("En evaluación desde hoy");
    expect(inReviewLabel(new Date(2026, 8, 24, 23), now)).toBe("En evaluación desde ayer");
    expect(inReviewLabel(new Date(2026, 8, 22, 9), now)).toBe("En evaluación hace 3 días");
  });
});

describe("missingPieces", () => {
  it("names what's missing in checklist order", () => {
    expect(
      missingPieces({
        location: false,
        idFront: true,
        idBack: false,
        businessPhotos: { have: 1, need: 3 }
      })
    ).toEqual(["ubicación", "cédula (reverso)", "2 fotos"]);
    expect(
      missingPieces({
        location: true,
        idFront: true,
        idBack: true,
        businessPhotos: { have: 3, need: 3 }
      })
    ).toEqual([]);
  });
});
