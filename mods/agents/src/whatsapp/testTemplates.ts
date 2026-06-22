/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { getConfig } from "@mikro/common";
import { createWhatsAppClient } from "./client/index.js";

const DIVIDER = "─".repeat(60);

function log(label: string, result: unknown) {
  console.log(`\n${DIVIDER}`);
  console.log(`  ${label}`);
  console.log(DIVIDER);
  console.log(JSON.stringify(result, null, 2));
}

async function testPaymentConfirmation(
  phone: string,
  client: ReturnType<typeof createWhatsAppClient>
) {
  const cfg = getConfig();
  const tpl = cfg.whatsapp.templates.paymentConfirmation;
  const lang = cfg.whatsapp.languageCode;
  // Use the promo banner route — already public/unauthenticated on the server.
  // Requires the apiserver to be running and ngrok to be active.
  const publicBase = cfg.publicUrl.replace(/\/+$/, "");
  const fakeImageUrl = `${publicBase}/assets/loan-application-promo.jpg`;
  const fakeToken = "test-token-00000";

  console.log(`\n[payment_confirmation] → ${tpl} (${lang})`);
  console.log(`  phone: ${phone}`);
  console.log(`  headerImageUrl: ${fakeImageUrl}`);
  console.log(`  bodyParameters: name="Cliente Test", amount="RD$1,000.00"`);
  console.log(`  urlButtonParameter: ${fakeToken}`);

  const result = await client.sendTemplateMessage({
    phone,
    templateName: tpl,
    languageCode: lang,
    headerImageUrl: fakeImageUrl,
    headerParameters: [],
    bodyParameters: [
      { parameter_name: "name", text: "Cliente Test" },
      { parameter_name: "amount", text: "RD$1,000.00" }
    ],
    urlButtonParameter: fakeToken
  });

  log("payment_confirmation result", result);
  return result;
}

async function testLoanApplicationPromo(
  phone: string,
  client: ReturnType<typeof createWhatsAppClient>
) {
  const cfg = getConfig();
  const tpl = cfg.whatsapp.templates.loanApplicationPromo;
  const lang = cfg.whatsapp.languageCode;
  const imageUrl =
    cfg.whatsapp.templates.loanApplicationPromoImageUrl ||
    "https://mikro.ngrok-free.dev/assets/loan-application-promo.jpg";
  const flowToken = "test-flow-token-" + Date.now();

  console.log(`\n[loan_application_promo] → ${tpl} (${lang})`);
  console.log(`  phone: ${phone}`);
  console.log(`  headerImageUrl: ${imageUrl}`);
  console.log(`  flowToken: ${flowToken}`);

  const result = await client.sendTemplateMessage({
    phone,
    templateName: tpl,
    languageCode: lang,
    headerParameters: [],
    bodyParameters: [],
    headerImageUrl: imageUrl,
    flowToken
  });

  log("loan_application_promo result", result);
  return result;
}

async function testFollowUpNudge(phone: string, client: ReturnType<typeof createWhatsAppClient>) {
  const cfg = getConfig();
  const tpl = cfg.whatsapp.templates.loanApplicationFollowUp;
  const lang = cfg.whatsapp.languageCode;

  console.log(`\n[loan_request_followup] → ${tpl} (${lang})`);
  console.log(`  phone: ${phone}`);
  console.log(`  bodyParameters: name="Pedro"`);

  // name param is required by the template (error 132000 if omitted)
  const result = await client.sendTemplateMessage({
    phone,
    templateName: tpl,
    languageCode: lang,
    headerParameters: [],
    bodyParameters: [{ parameter_name: "name", text: "Pedro" }]
  });

  log("follow_up result", result);
  return result;
}

async function main() {
  const [, , phone, which] = process.argv;

  if (!phone) {
    console.error(
      "Usage: npx tsx mods/agents/src/whatsapp/testTemplates.ts <phone> [payment_confirmation|loan_application|follow_up]"
    );
    process.exit(1);
  }

  const client = createWhatsAppClient();

  console.log(`\nMikro WhatsApp Template Smoke-Test`);
  console.log(`Phone: ${phone}`);
  console.log(`Config: ${process.env.MIKRO_CONFIG_FILE ?? "./mikro.json"}`);

  try {
    if (!which || which === "payment_confirmation") {
      await testPaymentConfirmation(phone, client);
    }
    if (!which || which === "loan_application") {
      await testLoanApplicationPromo(phone, client);
    }
    if (!which || which === "follow_up") {
      await testFollowUpNudge(phone, client);
    }
    console.log(`\n${DIVIDER}`);
    console.log("  Done.");
    console.log(DIVIDER);
  } catch (err) {
    console.error("\nFATAL:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
