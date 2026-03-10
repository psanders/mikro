/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { runCollectionsSchema, runSingleCollectionSchema } from "@mikro/common";

describe("collection schemas", () => {
  it("accepts appRef override for batch collections", () => {
    const result = runCollectionsSchema.parse({
      dryRun: true,
      includeDefaulted: true,
      appRef: "  app-123  "
    });

    expect(result.appRef).to.equal("app-123");
  });

  it("accepts appRef override for a single collection", () => {
    const result = runSingleCollectionSchema.parse({
      loanId: 10019,
      type: "COLLECTION_CALL",
      appRef: "  app-456  "
    });

    expect(result.appRef).to.equal("app-456");
  });
});
