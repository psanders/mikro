/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Dependency seam for the copilot tRPC procedures (design Decision 6). The
 * router is static, so the shared, startup-built dependencies (the tool executor
 * and the LLM model factory) are registered here at boot and read by the
 * procedures — the same pattern the WhatsApp message processor uses. Tests call
 * `setCopilotDeps` with a stubbed model factory so no live model is ever hit.
 */
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ToolExecutor } from "@mikro/agents";

export interface CopilotDeps {
  /** Executes existing business tools (reused from the WhatsApp DI seam). */
  toolExecutor: ToolExecutor;
  /** Factory for the chat model — injectable so tests can stub the LLM. */
  createModel: () => BaseChatModel;
}

let registered: CopilotDeps | undefined;

/** Register the copilot's shared dependencies (called once at startup / in tests). */
export function setCopilotDeps(deps: CopilotDeps): void {
  registered = deps;
}

/** Read the registered dependencies. Throws if the copilot was never wired up. */
export function getCopilotDeps(): CopilotDeps {
  if (!registered) {
    throw new Error("Copilot dependencies not configured. Call setCopilotDeps() at startup.");
  }
  return registered;
}

/** Clear the registry (test hygiene). */
export function clearCopilotDeps(): void {
  registered = undefined;
}
