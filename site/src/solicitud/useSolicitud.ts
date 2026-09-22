/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Everything the solicitud does besides drawing itself, shared by the stepper
 * (/solicitud) and the legacy accordion (/solicitud-v0) so the two send the
 * apiserver and Meta exactly the same things: form state, the per-visit
 * sessionId, section autosaves, the leave-page beacon, the SolicitudProgress
 * pixel event, and the final submit.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  trackLead,
  trackViewContent,
  trackCustom,
  newEventId,
  readFbCookies
} from "../lib/metaPixel";
import { readAdAttribution } from "../lib/adAttribution";
import {
  APPLICATION_SECTIONS,
  isSectionComplete,
  buildAutosavePayload
} from "@mikro/application-form";
import { INITIAL_FORM } from "./formConfig";

// Posts to the Mikro apiserver's public intake endpoint (POST /v1/applications).
const APPLICATIONS_URL = import.meta.env.VITE_APPLICATIONS_URL as string | undefined;

/**
 * Where the applicant ended up. `out_of_area`: the apiserver saved the
 * application but rejected it because we don't lend in their province yet.
 */
export type SolicitudOutcome = "pending" | "success" | "out_of_area";

/**
 * @param currentSection - The section the applicant has open right now (the
 *   stepper's current step, the accordion's open panel, or "" when the
 *   accordion is fully collapsed). Read by the leave-page beacon.
 */
export function useSolicitud(currentSection: string) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState(INITIAL_FORM);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SolicitudOutcome>("pending");
  const [error, setError] = useState("");
  // Sections we've already reported complete, so revisiting a finished
  // section doesn't fire SolicitudProgress twice.
  const trackedSections = useRef<Set<string>>(new Set());

  // Kept fresh on every render so the pagehide/visibilitychange listeners
  // (registered once, below) always read the current form without having to
  // re-subscribe on every keystroke.
  const formRef = useRef(form);
  const sectionRef = useRef(currentSection);
  const doneRef = useRef(false);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    sectionRef.current = currentSection;
  }, [currentSection]);
  useEffect(() => {
    doneRef.current = outcome !== "pending";
  }, [outcome]);

  useEffect(() => {
    trackViewContent();
  }, []);

  // Captures the applicant who fills half a section and closes the tab, which
  // a section-change autosave never sees. `sendBeacon` fires reliably even as
  // the page is unloading; a plain `fetch` there is not guaranteed to complete.
  // Sends a plain string body (not a typed Blob) so it stays a CORS-simple
  // request — the beacon spec provides no way to await a preflight, and
  // Content-Type "text/plain" is exactly what the apiserver's intake accepts
  // alongside JSON for this reason.
  useEffect(() => {
    const saveBeacon = () => {
      if (doneRef.current || !APPLICATIONS_URL || !sectionRef.current) return;
      const payload = buildAutosavePayload(
        formRef.current,
        readAdAttribution(),
        sessionId,
        sectionRef.current
      );
      try {
        navigator.sendBeacon(APPLICATIONS_URL, JSON.stringify(payload));
      } catch {
        // Best-effort, same as the section-change autosave.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveBeacon();
    };
    window.addEventListener("pagehide", saveBeacon);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", saveBeacon);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [sessionId]);

  const set = useCallback((name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  /**
   * Call when the applicant leaves a section (accordion toggle, stepper
   * Anterior/Siguiente). Posts a partial autosave tagged with that section and,
   * the first time the section's required fields are all filled, fires the
   * coarser `SolicitudProgress` Meta signal.
   */
  const leaveSection = useCallback(
    (sectionId: string) => {
      if (!sectionId) return;
      if (APPLICATIONS_URL) {
        // Attribution rides the autosaves too, so an applicant who abandons
        // halfway is still credited to the ad that brought them. Same payload
        // shape the leave-page beacon sends, above.
        fetch(APPLICATIONS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildAutosavePayload(form, readAdAttribution(), sessionId, sectionId)
          )
        }).catch(() => {});
      }

      if (!trackedSections.current.has(sectionId) && isSectionComplete(sectionId, form)) {
        const sectionNumber = APPLICATION_SECTIONS.findIndex((s) => s.id === sectionId) + 1;
        if (sectionNumber > 0) {
          trackCustom("SolicitudProgress", { section: sectionNumber });
          trackedSections.current.add(sectionId);
        }
      }
    },
    [form, sessionId]
  );

  const submit = useCallback(async () => {
    if (!agreed) {
      setError("Debes autorizar la consulta al buró de crédito para continuar.");
      return;
    }
    setError("");

    if (!APPLICATIONS_URL) {
      setError("El formulario no está configurado. Contacta al administrador.");
      return;
    }

    setSubmitting(true);
    // One id for this conversion, shared by the two copies of the Lead event:
    // the server sends it from the payload below, the browser sends it after.
    // Meta collapses them into one lead on this id.
    const eventId = newEventId();
    const { fbp, fbc } = readFbCookies();
    try {
      const res = await fetch(APPLICATIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Which ad produced this applicant, captured when they landed. Stored
          // with the application (unlike fbp/fbc below, which the server uses
          // for the Meta event and then drops) so lead quality can be reported
          // per ad.
          ...readAdAttribution(),
          sessionId,
          partial: false,
          eventId,
          fbp,
          fbc,
          eventSourceUrl: window.location.href
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json().catch(() => null);
      if (data?.result !== "ok") {
        throw new Error(data?.error ?? "Respuesta inesperada del servidor.");
      }

      // Saved but auto-rejected: we don't lend in their province yet. Not a
      // Lead — the server skips its copy too, so ads don't learn to find more
      // applicants we can't serve.
      if (data?.outcome === "out_of_area") {
        setOutcome("out_of_area");
        return;
      }

      trackLead(eventId);
      setOutcome("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "No se pudo conectar al servidor. Verifica tu conexión a internet e intenta de nuevo."
          : `Error al enviar la solicitud: ${msg || "intenta de nuevo."}`
      );
    } finally {
      setSubmitting(false);
    }
  }, [agreed, form, sessionId]);

  return {
    form,
    set,
    agreed,
    setAgreed,
    submitting,
    outcome,
    error,
    setError,
    leaveSection,
    submit
  };
}
