#!/usr/bin/env node
/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renders the solicitud summary PDF from a synthetic application (fake
 * applicant, generated photos, a made-up WhatsApp thread) for visual QA — no
 * database, no real customer data.
 *
 * Usage:
 *   npm run build -w mods/common
 *   node mods/common/scripts/render-application-summary.mjs [output.pdf]
 */
/* global process, console, Buffer */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? join(tmpdir(), "solicitud-sample.pdf");
const { renderSummaryPdf } = await import(
  pathToFileURL(join(here, "..", "dist", "contracts", "index.js")).href
);

const fontsDir = join(here, "..", "..", "apiserver", "assets", "fonts");
const font = (f) => readFileSync(join(fontsDir, f));

/** A placeholder "photo": a colored card with a caption. */
function photo(label, color, width = 1200, height = 900) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="50%" y="50%" font-family="Helvetica" font-size="64" fill="#fff" text-anchor="middle">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

const at = (iso) => new Date(iso);

const pdf = await renderSummaryPdf({
  id: "3f2a9c1e-5b7d-4e21-9a0c-1d2e3f4a5b6c",
  createdAt: at("2026-09-22T14:05:00Z"),
  status: "IN_REVIEW",
  firstName: "Ana",
  lastName: "Ejemplo Pérez",
  phone: "+18095550101",
  idNumber: "001-0000000-1",
  dateOfBirth: at("1988-04-12T12:00:00Z"),
  maritalStatus: "Casada",
  businessType: "COLMADO",
  businessName: "Colmado La Esquina",
  businessAge: "Más de 3 años",
  monthlySales: "RD$50,000 – RD$100,000",
  locationType: "Local alquilado",
  formalization: "Informal",
  employeeCount: "1 a 2",
  businessPhone: "+18095550102",
  requestedAmount: 25000,
  purpose: "Comprar mercancía",
  requestedTermWeeks: 12,
  spouseName: "Luis Ejemplo",
  spousePhone: "+18095550103",
  referenceName: "Carla Muestra",
  referencePhone: "+18095550104",
  housingType: "Propia",
  residenceTime: "Más de 5 años",
  homeAddress: "Calle Primera #12, Los Prados",
  province: "SANTO_DOMINGO",
  addressReference: "Frente al parque, casa verde",
  score: 72,
  riskBand: "MODERATE_RISK",
  recommendation: "APPROVE_WITH_CONDITIONS",
  confidence: "MEDIUM",
  scoreCategories: [
    { category: "PAYMENT_CAPACITY", weight: 35, score: 78 },
    { category: "BUSINESS_TYPE_RISK", weight: 20, score: 70 },
    { category: "ROOTEDNESS_STABILITY", weight: 15, score: 85 }
  ],
  evaluatorNotes: [
    {
      topic: "Ventas",
      question: "¿Cuánto vende en un día bueno y en uno flojo?",
      reason: "Las ventas declaradas son un rango amplio."
    }
  ],
  flags: [{ code: "INFORMAL", message: "Negocio sin RNC" }],
  aiSummary:
    "Colmado con más de 3 años en la misma esquina, ventas estables y vivienda propia. Pide RD$25,000 a 12 semanas para mercancía. Falta confirmar ventas diarias en la visita. 👍",
  mapUrl: "https://maps.google.com/?q=18.4861,-69.9312",
  documents: [
    { label: "Cédula frente", image: await photo("Cédula frente", "#1f4aa8", 1000, 630) },
    { label: "Cédula reverso", image: await photo("Cédula reverso", "#103a8a", 1000, 630) },
    { label: "Foto del negocio", image: await photo("Fachada", "#16a34a") },
    { label: "Foto del negocio", image: await photo("Interior", "#d97706", 900, 1200) },
    { label: "Foto del negocio", image: await photo("Mercancía", "#7c3aed") },
    { label: "Contrato (pendiente)", note: "Pendiente" }
  ],
  activity: [
    {
      summary: "Nueva solicitud de Ana Ejemplo",
      actorName: "José",
      occurredAt: at("2026-09-22T14:05:00Z")
    },
    { summary: "Tomada por Nicole", actorName: "Nicole", occurredAt: at("2026-09-22T15:20:00Z") },
    {
      summary: "Evidencia completa",
      actorName: "Pedro (cobrador)",
      occurredAt: at("2026-09-23T13:40:00Z")
    }
  ],
  conversation: {
    turns: [
      {
        role: "INBOUND",
        content: "Hola, quiero un préstamo para mi colmado",
        agentName: null,
        hasImage: false,
        createdAt: at("2026-09-22T13:50:00Z")
      },
      {
        role: "AGENT",
        content: "¡Hola! Soy José de Mikro 😊 Con gusto te ayudo. ¿Cuánto necesitas y para qué?",
        agentName: "jose",
        hasImage: false,
        createdAt: at("2026-09-22T13:50:20Z")
      },
      {
        role: "INBOUND",
        content: "Unos 25 mil para mercancía",
        agentName: null,
        hasImage: false,
        createdAt: at("2026-09-22T13:52:00Z")
      },
      {
        role: "INBOUND",
        content: "[Imagen]",
        agentName: null,
        hasImage: true,
        createdAt: at("2026-09-22T13:58:00Z")
      },
      {
        role: "AGENT",
        content:
          "Recibí tu cédula. Ya envié tu solicitud; una persona del equipo te contactará para la visita.",
        agentName: "jose",
        hasImage: false,
        createdAt: at("2026-09-22T14:05:10Z")
      },
      {
        role: "SYSTEM",
        content: "Recordatorio: tu visita es mañana a las 10:00 a. m.",
        agentName: null,
        hasImage: false,
        createdAt: at("2026-09-23T12:00:00Z")
      }
    ],
    handoffs: [{ reason: "Pidió hablar con una persona", openedAt: at("2026-09-22T14:10:00Z") }]
  },
  fonts: {
    regular: font("Inter-Regular.ttf"),
    medium: font("Inter-Medium.ttf"),
    semibold: font("Inter-SemiBold.ttf"),
    bold: font("Inter-Bold.ttf")
  }
});

writeFileSync(out, pdf);
console.log(`wrote ${out} (${pdf.length} bytes)`);
