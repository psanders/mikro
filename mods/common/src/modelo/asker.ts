/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Prompt source for the modelo CLI.
 *
 * readline only works turn-by-turn on a TTY. With piped stdin it emits every
 * `line` event as soon as the chunk arrives, so any `question()` issued after
 * the first tick never resolves and the process exits mid-questionnaire. That
 * makes scripted runs (`printf '...' | model-simulation db`) silently truncate, so
 * piped input is drained upfront and served from a queue instead.
 */
import { createInterface } from "node:readline/promises";
import type { Readable } from "node:stream";

export type Asker = {
  ask(prompt: string): Promise<string>;
  close(): void;
};

export function createTtyAsker(): Asker {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: (prompt) => rl.question(prompt),
    close: () => rl.close()
  };
}

async function readAll(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Serves answers from already-buffered input. Once the queue runs dry every
 * further prompt answers with "", which the CLI reads as "keep this value" —
 * a short script tweaks the levers it cares about and accepts the rest.
 */
export function createQueueAsker(lines: string[], echo = true): Asker {
  const queue = [...lines];
  return {
    ask: async (prompt) => {
      const answer = queue.shift() ?? "";
      if (echo) process.stdout.write(`${prompt}${answer}\n`);
      return answer;
    },
    close: () => {}
  };
}

export async function createAsker(): Promise<Asker> {
  if (process.stdin.isTTY) return createTtyAsker();
  const raw = await readAll(process.stdin);
  const lines = raw.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return createQueueAsker(lines);
}
