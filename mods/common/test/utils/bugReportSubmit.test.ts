/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Covers the two mikro/#97 fixes: always-Spanish error copy (no raw English
 * leak) and automatic retry of transient submit failures with the same
 * already-captured recording.
 */
import { expect } from "chai";
import {
  isNetworkError,
  isRetryableBugReportError,
  toSpanishBugReportError,
  submitBugReportWithRetry
} from "../../src/utils/bugReportSubmit.js";

/** Minimal stand-in for a TRPCClientError: the client reads `err.data.code`. */
function trpcError(code: string, httpStatus?: number): Error & { data: unknown } {
  const err = new Error(`server said ${code}`) as Error & { data: unknown };
  err.data = { code, ...(httpStatus !== undefined ? { httpStatus } : {}) };
  return err;
}

const noSleep = () => Promise.resolve();

describe("bugReportSubmit — error classification", () => {
  it("recognises web and RN fetch failures as network errors", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).to.be.true; // web
    expect(isNetworkError(new TypeError("Network request failed"))).to.be.true; // RN
    expect(isNetworkError(new Error("Load failed"))).to.be.true; // Safari
    expect(isNetworkError("connection refused")).to.be.true;
  });

  it("does not treat a server-answered tRPC error as a network error", () => {
    expect(isNetworkError(trpcError("BAD_REQUEST", 400))).to.be.false;
    expect(isNetworkError(trpcError("TOO_MANY_REQUESTS", 429))).to.be.false;
  });

  it("retries transient failures (network, rate limit, 5xx) and not deterministic ones", () => {
    expect(isRetryableBugReportError(new TypeError("Failed to fetch"))).to.be.true;
    expect(isRetryableBugReportError(trpcError("TOO_MANY_REQUESTS", 429))).to.be.true;
    expect(isRetryableBugReportError(trpcError("INTERNAL_SERVER_ERROR", 500))).to.be.true;
    expect(isRetryableBugReportError(trpcError("BAD_GATEWAY", 502))).to.be.true;

    expect(isRetryableBugReportError(trpcError("BAD_REQUEST", 400))).to.be.false;
    expect(isRetryableBugReportError(trpcError("PRECONDITION_FAILED", 412))).to.be.false;
    expect(isRetryableBugReportError(trpcError("UNAUTHORIZED", 401))).to.be.false;
  });
});

describe("bugReportSubmit — toSpanishBugReportError", () => {
  it("never leaks a raw English error message", () => {
    const messages = [
      toSpanishBugReportError(new TypeError("Failed to fetch")),
      toSpanishBugReportError(trpcError("TOO_MANY_REQUESTS", 429)),
      toSpanishBugReportError(trpcError("INTERNAL_SERVER_ERROR", 500)),
      toSpanishBugReportError(new Error("some raw english detail"))
    ];
    for (const msg of messages) {
      expect(msg).to.not.match(/failed to fetch|server said|english|error:/i);
    }
  });

  it("gives distinct, actionable Spanish copy per failure kind", () => {
    expect(toSpanishBugReportError(trpcError("TOO_MANY_REQUESTS", 429))).to.match(
      /espera un momento/i
    );
    expect(toSpanishBugReportError(new TypeError("Failed to fetch"))).to.match(/conexión/i);
    expect(toSpanishBugReportError(trpcError("PRECONDITION_FAILED", 412))).to.match(
      /no se pudo enviar/i
    );
  });
});

describe("bugReportSubmit — submitBugReportWithRetry", () => {
  it("returns the result without retrying when the first attempt succeeds", async () => {
    let calls = 0;
    const result = await submitBugReportWithRetry(
      async () => {
        calls += 1;
        return { issueUrl: "https://github.com/o/r/issues/1" };
      },
      { sleep: noSleep }
    );
    expect(calls).to.equal(1);
    expect(result.issueUrl).to.equal("https://github.com/o/r/issues/1");
  });

  it("retries a transient failure and succeeds on a later attempt", async () => {
    let calls = 0;
    const delays: number[] = [];
    const result = await submitBugReportWithRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new TypeError("Failed to fetch");
        return { issueUrl: "ok" };
      },
      { sleep: async (ms) => void delays.push(ms) }
    );
    expect(calls).to.equal(3);
    expect(result.issueUrl).to.equal("ok");
    // Exponential backoff: 2000ms then 4000ms before the third, successful try.
    expect(delays).to.deep.equal([2000, 4000]);
  });

  it("stops immediately and rethrows a non-retryable error (no wasted retries)", async () => {
    let calls = 0;
    let thrown: unknown;
    try {
      await submitBugReportWithRetry(
        async () => {
          calls += 1;
          throw trpcError("PRECONDITION_FAILED", 412);
        },
        { sleep: noSleep }
      );
    } catch (err) {
      thrown = err;
    }
    expect(calls).to.equal(1);
    expect(getData(thrown)).to.deep.include({ code: "PRECONDITION_FAILED" });
  });

  it("gives up after maxAttempts and rethrows the original error unchanged", async () => {
    let calls = 0;
    let thrown: unknown;
    try {
      await submitBugReportWithRetry(
        async () => {
          calls += 1;
          throw new TypeError("Failed to fetch");
        },
        { sleep: noSleep, maxAttempts: 4 }
      );
    } catch (err) {
      thrown = err;
    }
    expect(calls).to.equal(4);
    expect(thrown).to.be.instanceOf(TypeError);
    // Still maps to Spanish for display after retries are exhausted.
    expect(toSpanishBugReportError(thrown)).to.match(/conexión/i);
  });

  it("caps the backoff delay at maxDelayMs", async () => {
    const delays: number[] = [];
    try {
      await submitBugReportWithRetry(async () => Promise.reject(new TypeError("Failed to fetch")), {
        sleep: async (ms) => void delays.push(ms),
        maxAttempts: 5,
        baseDelayMs: 2000,
        maxDelayMs: 8000
      });
    } catch {
      // expected
    }
    // 2000, 4000, 8000, then capped at 8000 (not 16000).
    expect(delays).to.deep.equal([2000, 4000, 8000, 8000]);
  });
});

function getData(err: unknown): unknown {
  return err && typeof err === "object" && "data" in err
    ? (err as { data: unknown }).data
    : undefined;
}
