/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { createClient } from "@deepgram/sdk";
import { logger } from "../logger.js";

/**
 * Decode a base64 data URL to a Buffer.
 * @param dataUrl - e.g. "data:audio/ogg;base64,T2dnUw..."
 * @returns Buffer of the decoded content
 */
function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid audio data URL format");
  }
  const base64 = match[2];
  if (!base64) {
    throw new Error("Missing base64 payload in data URL");
  }
  return Buffer.from(base64, "base64");
}

/**
 * Create a function that transcribes voice note audio (data URL) to text using Deepgram.
 * Uses model nova-3 and language es (Spanish).
 *
 * @param apiKey - Deepgram API key
 * @returns Function that takes an audio data URL and returns the transcript text, or throws on failure
 */
export function createTranscribeVoiceNote(
  apiKey: string
): (audioDataUrl: string) => Promise<string> {
  const deepgram = createClient(apiKey);

  return async (audioDataUrl: string): Promise<string> => {
    const buffer = dataUrlToBuffer(audioDataUrl);
    logger.verbose("transcribing voice note", { size: buffer.length });

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(buffer, {
      model: "nova-3",
      language: "es"
    });

    if (error) {
      logger.error("deepgram transcription error", { message: error.message });
      throw error;
    }

    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
    logger.verbose("voice note transcribed", { length: transcript.length });
    return transcript;
  };
}
