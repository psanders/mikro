/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The slice of the Chrome extension API the Mikro Decisión extension uses
 * (keeps @types/chrome out of the dependency tree).
 */
declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: { id?: number };
    }
    function sendMessage<T = unknown>(message: unknown): Promise<T>;
    function openOptionsPage(): Promise<void>;
    const onMessage: {
      addListener(
        cb: (message: any, sender: MessageSender, sendResponse: (r: unknown) => void) => boolean | void
      ): void;
    };
  }
  namespace storage {
    const local: {
      get(keys: string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string[]): Promise<void>;
    };
  }
  namespace permissions {
    function request(p: { origins: string[] }): Promise<boolean>;
    function contains(p: { origins: string[] }): Promise<boolean>;
  }
}
