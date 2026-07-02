/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shown to authenticated non-admin users (COLLECTOR/REVIEWER) on every route —
 * the operations UI is retired, so there is nothing else for these roles to
 * land on. Matches the founder visual language (FounderShell's rail mark,
 * FeedEmptyState/FeedErrorState's centered-card idiom) rather than the old ops
 * chrome.
 */
import { ShipWheel, LogOut, Smartphone } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function AccessScreen() {
  const { userName, logout } = useAuth();

  return (
    <div className="flex h-dvh w-full flex-col bg-white text-[#14254A]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#E5EAF1] px-6 py-[15px]">
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#1F4AA8] text-white">
            <ShipWheel size={16} strokeWidth={2} />
          </div>
          <span className="text-[15px] font-bold tracking-[-0.3px]">mikro</span>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-[7px] rounded-[9px] border border-[#E5EAF1] bg-white px-4 py-[9px] text-[14px] font-medium text-[#14254A] transition hover:bg-[#F4F7FB]"
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center bg-[#F4F7FB] px-6">
        <div className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[14px] border border-[#E5EAF1] bg-white px-8 py-12 text-center">
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[13px] bg-[#E9F2FF] text-[#1F4AA8]">
            <Smartphone size={24} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[17px] font-bold text-[#14254A]">
              Esta aplicación es el panel de fundadores
            </p>
            <p className="text-[13px] font-medium leading-[1.5] text-[#697A93]">
              {userName ? `${userName}, tu` : "Tu"} trabajo diario — cobros, revisión y solicitudes
              — ahora vive en la app móvil de Mikro. Ábrela en tu teléfono para continuar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
