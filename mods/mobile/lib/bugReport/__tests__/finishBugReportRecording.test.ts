/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { finishBugReportRecording } from "../finishBugReportRecording";
import type { ScreenRecordingFile } from "react-native-nitro-screen-recorder";

function makeFile(overrides: Partial<ScreenRecordingFile> = {}): ScreenRecordingFile {
  return {
    path: "/tmp/recording.mp4",
    name: "recording.mp4",
    size: 1024,
    duration: 12.5,
    enabledMicrophone: true,
    ...overrides
  };
}

describe("finishBugReportRecording", () => {
  it("reads the video, extracts a screenshot, and submits both in the expected shape", async () => {
    const submit = jest
      .fn()
      .mockResolvedValue({ issueUrl: "https://github.com/psanders/mikro/issues/123" });
    const readBase64 = jest.fn().mockResolvedValue("dmlkZW8=");
    const extractScreenshot = jest
      .fn()
      .mockResolvedValue({ base64: "aW1n", mimeType: "image/jpeg" });

    const result = await finishBugReportRecording(makeFile(), {
      readBase64,
      extractScreenshot,
      submit,
      platform: "ios"
    });

    expect(result.issueUrl).toBe("https://github.com/psanders/mikro/issues/123");
    expect(readBase64).toHaveBeenCalledWith("/tmp/recording.mp4");
    expect(extractScreenshot).toHaveBeenCalledWith("/tmp/recording.mp4");
    expect(submit).toHaveBeenCalledWith({
      videoBase64: "dmlkZW8=",
      videoMimeType: "video/mp4",
      screenshotBase64: "aW1n",
      screenshotMimeType: "image/jpeg",
      pageUrl: "mikro://perfil",
      userAgent: "Mikro Mobile/ios"
    });
  });

  it("throws and never submits when there is no recording file (validation failure)", async () => {
    const submit = jest.fn();
    const readBase64 = jest.fn();
    const extractScreenshot = jest.fn();

    await expect(
      finishBugReportRecording(undefined, {
        readBase64,
        extractScreenshot,
        submit,
        platform: "android"
      })
    ).rejects.toThrow("No se generó ningún archivo de grabación.");

    expect(readBase64).not.toHaveBeenCalled();
    expect(extractScreenshot).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not submit when reading the video file fails", async () => {
    const submit = jest.fn();
    const readBase64 = jest.fn().mockRejectedValue(new Error("disk read failed"));
    const extractScreenshot = jest
      .fn()
      .mockResolvedValue({ base64: "aW1n", mimeType: "image/jpeg" });

    await expect(
      finishBugReportRecording(makeFile(), {
        readBase64,
        extractScreenshot,
        submit,
        platform: "android"
      })
    ).rejects.toThrow("disk read failed");

    expect(submit).not.toHaveBeenCalled();
  });

  it("propagates the server error and does not swallow it when submit fails", async () => {
    const submit = jest
      .fn()
      .mockRejectedValue(new Error("Espera un momento antes de enviar otro reporte."));
    const readBase64 = jest.fn().mockResolvedValue("dmlkZW8=");
    const extractScreenshot = jest
      .fn()
      .mockResolvedValue({ base64: "aW1n", mimeType: "image/jpeg" });

    await expect(
      finishBugReportRecording(makeFile(), {
        readBase64,
        extractScreenshot,
        submit,
        platform: "ios"
      })
    ).rejects.toThrow("Espera un momento antes de enviar otro reporte.");
  });
});
