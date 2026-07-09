/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import type { AIMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Octokit } from "@octokit/rest";
import {
  createSubmitFeedback,
  type SubmitFeedbackDeps
} from "../../src/api/feedback/createSubmitFeedback.js";
import type { SubmitFeedbackInput } from "@mikro/common";

// No client sends a screenshot anymore (mikro/#87 follow-up: the video is
// strictly more useful and is now the default/only visual) — screenshot
// fields are optional legacy fallback, exercised separately below.
const BASE_INPUT: SubmitFeedbackInput = {
  videoBase64: Buffer.from("fake video bytes").toString("base64"),
  videoMimeType: "video/webm",
  pageUrl: "https://app.mikro.do/founder",
  userAgent: "TestAgent/1.0"
};

const WITH_SCREENSHOT_INPUT: SubmitFeedbackInput = {
  ...BASE_INPUT,
  screenshotBase64: Buffer.from("fake png bytes").toString("base64"),
  screenshotMimeType: "image/png"
};

// Tauri desktop sends this: the video is silent (ScreenCaptureKit has no mic
// track), so the mic-only narration audio is what should actually get
// transcribed (mikro/#156).
const WITH_AUDIO_INPUT: SubmitFeedbackInput = {
  ...BASE_INPUT,
  audioBase64: Buffer.from("fake mic audio bytes").toString("base64"),
  audioMimeType: "audio/webm"
};

const REPORTER = { userId: "user-1", name: "Ana Reviewer" };

const STRUCTURED_REPLY = JSON.stringify({
  title: "El botón de guardar no responde",
  summary: "El botón de guardar no responde en la pantalla X.",
  details: "1. Abrir pantalla X\n2. Tocar Guardar\nEsperado: guarda y vuelve. Actual: no pasa nada."
});

function stubModel(reply: string): () => BaseChatModel {
  const invoke = sinon.stub().resolves({ content: reply } as unknown as AIMessage);
  return () => ({ invoke }) as unknown as BaseChatModel;
}

function stubOctokit(overrides?: {
  createOrUpdateFileContents?: sinon.SinonStub;
  issuesCreate?: sinon.SinonStub;
}): Octokit {
  const createOrUpdateFileContents =
    overrides?.createOrUpdateFileContents ??
    sinon.stub().callsFake(({ path }: { path: string }) =>
      Promise.resolve({
        data: { content: { download_url: `https://raw.githubusercontent.com/o/r/main/${path}` } }
      })
    );
  const issuesCreate =
    overrides?.issuesCreate ??
    sinon.stub().resolves({ data: { html_url: "https://github.com/o/r/issues/1" } });
  return {
    repos: { createOrUpdateFileContents },
    issues: { create: issuesCreate }
  } as unknown as Octokit;
}

/** Rejects uploads whose path ends with the given extension, resolves the rest — for testing one-of-two-uploads-fails scenarios. */
function stubOctokitFailingExt(ext: string): Octokit {
  const createOrUpdateFileContents = sinon.stub().callsFake(({ path }: { path: string }) =>
    path.endsWith(`.${ext}`)
      ? Promise.reject(new Error("403"))
      : Promise.resolve({
          data: {
            content: { download_url: `https://raw.githubusercontent.com/o/r/main/${path}` }
          }
        })
  );
  return stubOctokit({ createOrUpdateFileContents });
}

describe("createSubmitFeedback", () => {
  afterEach(() => sinon.restore());

  it("files an issue with the structured feedback and the video as the sole visual (no screenshot sent)", async () => {
    const transcribe = sinon.stub().resolves("El botón de guardar no funciona en la pantalla X.");
    const createModel = stubModel(STRUCTURED_REPLY);
    const octokit = stubOctokit();

    const fn = createSubmitFeedback({ transcribe, createModel, octokit, repo: "psanders/mikro" });
    const result = await fn(BASE_INPUT, REPORTER);

    expect(result).to.deep.equal({ issueUrl: "https://github.com/o/r/issues/1" });
    expect(transcribe.calledOnce).to.be.true;
    expect(transcribe.firstCall.args[0]).to.match(/^data:video\/webm;base64,/);

    const issueArgs = (octokit.issues.create as unknown as sinon.SinonStub).firstCall.args[0];
    expect(issueArgs.owner).to.equal("psanders");
    expect(issueArgs.repo).to.equal("mikro");
    expect(issueArgs.title).to.equal("El botón de guardar no responde");
    expect(issueArgs.body).to.contain("## Resumen");
    expect(issueArgs.body).to.contain("## Detalles");
    expect(issueArgs.body).to.contain("no pasa nada");
    expect(issueArgs.body).to.contain("## Grabación");
    expect(issueArgs.body).to.match(/raw\.githubusercontent\.com\/o\/r\/main\/feedback\/.*\.webm/);
    expect(issueArgs.body).to.not.contain("## Captura de pantalla");
    expect(issueArgs.body).to.contain("Ana Reviewer");
    expect(issueArgs.body).to.contain("https://app.mikro.do/founder");

    // No screenshot was sent, so only the video gets committed — no attempt
    // is made to upload a screenshot that doesn't exist.
    const uploadCalls = (
      octokit.repos.createOrUpdateFileContents as unknown as sinon.SinonStub
    ).getCalls();
    expect(uploadCalls).to.have.length(1);
  });

  it("transcribes the mic-only audio instead of the (silent) video when a client sends one (mikro/#156)", async () => {
    const transcribe = sinon.stub().resolves("narración por micrófono en Tauri");
    const createModel = stubModel(STRUCTURED_REPLY);
    const octokit = stubOctokit();

    const fn = createSubmitFeedback({ transcribe, createModel, octokit, repo: "psanders/mikro" });
    await fn(WITH_AUDIO_INPUT, REPORTER);

    expect(transcribe.calledOnce).to.be.true;
    expect(transcribe.firstCall.args[0]).to.match(/^data:audio\/webm;base64,/);
    expect(transcribe.firstCall.args[0]).to.not.match(/^data:video/);

    // The video is still committed and linked — audio only changes what gets
    // transcribed, not what's uploaded as the visual artifact.
    const uploadCalls = (
      octokit.repos.createOrUpdateFileContents as unknown as sinon.SinonStub
    ).getCalls();
    expect(uploadCalls).to.have.length(1);
    expect(uploadCalls[0]!.args[0].path).to.match(/\.webm$/);
  });

  it("still commits the legacy screenshot when a client sends one, alongside the video", async () => {
    const transcribe = sinon.stub().resolves("narración de prueba");
    const createModel = stubModel(STRUCTURED_REPLY);
    const octokit = stubOctokit();

    const fn = createSubmitFeedback({ transcribe, createModel, octokit, repo: "psanders/mikro" });
    await fn(WITH_SCREENSHOT_INPUT, REPORTER);

    const issueArgs = (octokit.issues.create as unknown as sinon.SinonStub).firstCall.args[0];
    expect(issueArgs.body).to.contain("## Grabación");
    expect(issueArgs.body).to.contain("## Captura de pantalla");
    // Video is the default/primary artifact — it leads the screenshot in the body.
    expect(issueArgs.body.indexOf("## Grabación")).to.be.lessThan(
      issueArgs.body.indexOf("## Captura de pantalla")
    );
  });

  it("still files an issue when transcription fails (best-effort)", async () => {
    const transcribe = sinon.stub().rejects(new Error("deepgram down"));
    const createModel = stubModel("{}"); // must not even be called
    const octokit = stubOctokit();

    const fn = createSubmitFeedback({ transcribe, createModel, octokit, repo: "psanders/mikro" });
    const result = await fn(BASE_INPUT, REPORTER);

    expect(result.issueUrl).to.equal("https://github.com/o/r/issues/1");
    expect((createModel() as unknown as { invoke: sinon.SinonStub }).invoke.called).to.be.false;
    const issueArgs = (octokit.issues.create as unknown as sinon.SinonStub).firstCall.args[0];
    expect(issueArgs.title).to.equal("Feedback (sin transcripción)");
    expect(issueArgs.body).to.not.contain("Transcripción completa");
  });

  it("falls back to a generic write-up when the LLM output isn't valid JSON", async () => {
    const transcribe = sinon.stub().resolves("algo pasó pero no sé qué");
    const createModel = stubModel("no puedo ayudar con eso");
    const octokit = stubOctokit();

    const fn = createSubmitFeedback({ transcribe, createModel, octokit, repo: "psanders/mikro" });
    const result = await fn(BASE_INPUT, REPORTER);

    expect(result.issueUrl).to.equal("https://github.com/o/r/issues/1");
    const issueArgs = (octokit.issues.create as unknown as sinon.SinonStub).firstCall.args[0];
    expect(issueArgs.title).to.equal("Feedback (sin transcripción)");
    expect(issueArgs.body).to.contain("algo pasó pero no sé qué");
  });

  it("still files an issue when the video upload fails and no screenshot was sent (worst case, no visuals)", async () => {
    const transcribe = sinon.stub().resolves("narración de prueba");
    const createModel = stubModel(STRUCTURED_REPLY);
    const createOrUpdateFileContents = sinon.stub().rejects(new Error("403"));
    const octokit = stubOctokit({ createOrUpdateFileContents });

    const fn = createSubmitFeedback({ transcribe, createModel, octokit, repo: "psanders/mikro" });
    const result = await fn(BASE_INPUT, REPORTER);

    expect(result.issueUrl).to.equal("https://github.com/o/r/issues/1");
    const issueArgs = (octokit.issues.create as unknown as sinon.SinonStub).firstCall.args[0];
    expect(issueArgs.body).to.not.contain("Captura de pantalla");
    expect(issueArgs.body).to.not.contain("## Grabación");
  });

  it("still files an issue when only the legacy screenshot upload fails (best-effort)", async () => {
    const transcribe = sinon.stub().resolves("narración de prueba");
    const createModel = stubModel(STRUCTURED_REPLY);
    const octokit = stubOctokitFailingExt("png");

    const fn = createSubmitFeedback({ transcribe, createModel, octokit, repo: "psanders/mikro" });
    const result = await fn(WITH_SCREENSHOT_INPUT, REPORTER);

    expect(result.issueUrl).to.equal("https://github.com/o/r/issues/1");
    const issueArgs = (octokit.issues.create as unknown as sinon.SinonStub).firstCall.args[0];
    expect(issueArgs.body).to.not.contain("## Captura de pantalla");
    expect(issueArgs.body).to.contain("## Grabación");
  });

  it("still files an issue when only the video upload fails but a legacy screenshot succeeds (best-effort)", async () => {
    const transcribe = sinon.stub().resolves("narración de prueba");
    const createModel = stubModel(STRUCTURED_REPLY);
    const octokit = stubOctokitFailingExt("webm");

    const fn = createSubmitFeedback({ transcribe, createModel, octokit, repo: "psanders/mikro" });
    const result = await fn(WITH_SCREENSHOT_INPUT, REPORTER);

    expect(result.issueUrl).to.equal("https://github.com/o/r/issues/1");
    const issueArgs = (octokit.issues.create as unknown as sinon.SinonStub).firstCall.args[0];
    expect(issueArgs.body).to.contain("## Captura de pantalla");
    expect(issueArgs.body).to.not.contain("## Grabación");
  });

  it("never surfaces the issue URL as something for the user to visit (private repos)", async () => {
    // Regression guard for the UX change: users don't have repo access once
    // the target repos go private, so the client deliberately never renders
    // `issueUrl` — this just documents that the field still exists for
    // internal/server-side consumers even though the UI ignores it.
    const transcribe = sinon.stub().resolves("narración de prueba");
    const createModel = stubModel(STRUCTURED_REPLY);
    const octokit = stubOctokit();

    const fn = createSubmitFeedback({ transcribe, createModel, octokit, repo: "psanders/mikro" });
    const result = await fn(BASE_INPUT, REPORTER);

    expect(Object.keys(result)).to.deep.equal(["issueUrl"]);
  });

  it("throws PRECONDITION_FAILED and never files an issue when repo is not configured", async () => {
    const octokit = stubOctokit();
    const fn = createSubmitFeedback({
      transcribe: sinon.stub(),
      createModel: stubModel("{}"),
      octokit,
      repo: ""
    });

    let thrown: { code?: string } | undefined;
    try {
      await fn(BASE_INPUT, REPORTER);
    } catch (err) {
      thrown = err as { code?: string };
    }
    expect(thrown?.code).to.equal("PRECONDITION_FAILED");
    // The precondition guard fires before any side effect — no issue is filed.
    expect((octokit.issues.create as unknown as sinon.SinonStub).called).to.be.false;
  });

  it("throws PRECONDITION_FAILED when repo is malformed (no owner/repo split)", async () => {
    const fn = createSubmitFeedback({
      transcribe: sinon.stub(),
      createModel: stubModel("{}"),
      octokit: stubOctokit(),
      repo: "not-a-valid-repo-string"
    });

    let thrown: { code?: string } | undefined;
    try {
      await fn(BASE_INPUT, REPORTER);
    } catch (err) {
      thrown = err as { code?: string };
    }
    expect(thrown?.code).to.equal("PRECONDITION_FAILED");
  });
});

// Type-level sanity: SubmitFeedbackDeps must expose exactly these members.
const _typeCheck: SubmitFeedbackDeps = {
  transcribe: async () => "",
  createModel: stubModel("{}"),
  octokit: stubOctokit(),
  repo: "o/r"
};
void _typeCheck;
