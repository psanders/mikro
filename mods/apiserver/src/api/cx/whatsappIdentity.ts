/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * WhatsApp username senders (openspec whatsapp-username-senders). A user who
 * adopts a WhatsApp username may reach us with no phone, only a business-scoped
 * user id (BSUID). We keep that id (and the username) on their customer and
 * application rows, internally, so a later username-only message still finds
 * them. Nothing here is shown in the dashboard.
 */
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";

type Db = Pick<PrismaClient, "customer" | "loanApplication">;

export interface WhatsAppIdentityLink {
  /** The sender's phone (E.164), when Meta included it. */
  phone?: string;
  bsuid: string;
  username?: string;
}

/**
 * Whenever a message carries BOTH the phone and the BSUID, record the BSUID on
 * every customer and application with that phone. Idempotent: rows that
 * already have this BSUID are not touched, so repeat messages cost two cheap
 * indexed no-op updates. Never throws.
 */
export function createLinkWhatsAppIdentity(db: Db) {
  return async ({ phone, bsuid, username }: WhatsAppIdentityLink): Promise<void> => {
    if (!phone) return;
    const where = {
      phone,
      OR: [{ whatsappUserId: null }, { whatsappUserId: { not: bsuid } }]
    };
    const data = { whatsappUserId: bsuid, ...(username ? { whatsappUsername: username } : {}) };
    try {
      const [customers, applications] = await Promise.all([
        db.customer.updateMany({ where, data }),
        db.loanApplication.updateMany({ where, data })
      ]);
      if (customers.count || applications.count) {
        logger.info("whatsapp identity linked", {
          phone,
          bsuid,
          customers: customers.count,
          applications: applications.count
        });
      }
    } catch (err) {
      logger.error("failed to link whatsapp identity", {
        bsuid,
        error: (err as Error).message
      });
    }
  };
}

/**
 * The sender shared their own number (answering a contact-info request, e.g.
 * from Chatwoot). Fill the phone on their applications that have none, then
 * link the BSUID to everything with that phone. Never throws.
 */
export function createRecordSharedWhatsAppPhone(db: Db) {
  const link = createLinkWhatsAppIdentity(db);
  return async ({
    phone,
    bsuid,
    username
  }: Required<Pick<WhatsAppIdentityLink, "phone">> & WhatsAppIdentityLink): Promise<void> => {
    try {
      const filled = await db.loanApplication.updateMany({
        where: { whatsappUserId: bsuid, phone: null },
        data: { phone }
      });
      if (filled.count) {
        logger.info("shared whatsapp phone filled on applications", {
          bsuid,
          applications: filled.count
        });
      }
    } catch (err) {
      logger.error("failed to record shared whatsapp phone", {
        bsuid,
        error: (err as Error).message
      });
    }
    await link({ phone, bsuid, username });
  };
}

/** The customer a BSUID was linked to, or null. */
export function createFindCustomerByWhatsAppUserId(db: Pick<PrismaClient, "customer">) {
  return async (
    bsuid: string
  ): Promise<{ id: string; name: string; phone: string; isActive: boolean } | null> => {
    return db.customer.findFirst({
      where: { whatsappUserId: bsuid },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, phone: true, isActive: true }
    });
  };
}
