/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useEffect, useState } from "react";
import { X, Minimize2, Maximize2 } from "lucide-react";

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function CustomTitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    let active = true;
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const window = getCurrentWindow();
        if (active) {
          setIsMaximized(await window.isMaximized());
        }
      } catch (err) {
        console.error("failed to check window state", err);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleMinimize = async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  };

  const handleToggleMaximize = async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const window = getCurrentWindow();
    const newMaximized = !isMaximized;
    if (newMaximized) {
      await window.maximize();
    } else {
      await window.unmaximize();
    }
    setIsMaximized(newMaximized);
  };

  const handleClose = async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  };

  if (!isTauri()) return null;

  return (
    <div
      data-tauri-drag-region
      className="flex h-11 items-center justify-between bg-white border-b border-[#E5EAF1] px-4 select-none"
    >
      <div className="flex-1" />
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleMinimize}
          className="p-2 hover:bg-[#F4F7FB] rounded transition"
          aria-label="Minimize"
        >
          <Minimize2 size={16} className="text-[#697A93]" />
        </button>
        <button
          onClick={handleToggleMaximize}
          className="p-2 hover:bg-[#F4F7FB] rounded transition"
          aria-label="Maximize"
        >
          <Maximize2 size={16} className="text-[#697A93]" />
        </button>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-red-50 rounded transition"
          aria-label="Close"
        >
          <X size={16} className="text-[#697A93] hover:text-red-600" />
        </button>
      </div>
    </div>
  );
}
