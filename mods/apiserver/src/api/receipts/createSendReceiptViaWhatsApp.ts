/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  sendReceiptViaWhatsAppSchema,
  type SendReceiptViaWhatsAppInput,
  type DbClient,
  type WhatsAppSendResponse
} from "@mikro/common";
import { type GenerateReceiptResponse } from "./createGenerateReceipt.js";
import { saveReceiptImage } from "../../receipts/storage.js";
import { getImagesPath, getPublicImageUrl } from "@mikro/agents";
import { logger } from "../../logger.js";

/**
 * Response from sendReceiptViaWhatsApp.
 */
export interface SendReceiptViaWhatsAppResponse {
  /** Success indicator */
  success: boolean;
  /** Message ID from WhatsApp API */
  messageId?: string;
  /** Public URL of the saved receipt image */
  imageUrl?: string;
  /** Media ID from WhatsApp upload */
  mediaId?: string;
  /** Error message if sending failed */
  error?: string;
}

/**
 * Dependencies for sending receipt via WhatsApp.
 */
export interface SendReceiptViaWhatsAppDependencies {
  db: DbClient;
  generateReceipt: (params: { paymentId: string }) => Promise<GenerateReceiptResponse>;
  sendWhatsAppMessage: (params: {
    phone: string;
    imageUrl?: string;
    mediaId?: string;
    caption?: string;
  }) => Promise<WhatsAppSendResponse>;
  uploadMedia: (imageBuffer: Buffer, mimeType: string) => Promise<string>;
  imagesPath?: string;
}

/**
 * Creates a function to send a receipt via WhatsApp.
 *
 * This function:
 * 1. Generates the receipt
 * 2. Saves the image to disk
 * 3. Gets the public URL
 * 4. Fetches member phone from payment
 * 5. Sends the image via WhatsApp
 *
 * @param deps - Dependencies including database client, receipt generator, and WhatsApp sender
 * @returns A validated function that sends receipts via WhatsApp
 */
export function createSendReceiptViaWhatsApp(
  deps: SendReceiptViaWhatsAppDependencies
) {
  const {
    db,
    generateReceipt,
    sendWhatsAppMessage,
    uploadMedia,
    imagesPath = getImagesPath()
  } = deps;

  const fn = async (
    params: SendReceiptViaWhatsAppInput
  ): Promise<SendReceiptViaWhatsAppResponse> => {
    logger.verbose("sending receipt via whatsapp", { paymentId: params.paymentId });

    try {
      // 1. Fetch payment to get member phone
      const payment = await db.payment.findUnique({
        where: { id: params.paymentId },
        include: {
          loan: {
            include: {
              member: true
            }
          }
        }
      });

      if (!payment) {
        throw new Error(`Payment not found: ${params.paymentId}`);
      }

      const memberPhone = payment.loan.member.phone;
      if (!memberPhone) {
        throw new Error(`Member phone not found for payment: ${params.paymentId}`);
      }

      // 2. Generate receipt
      const receipt = await generateReceipt({ paymentId: params.paymentId });
      const loanNumber = receipt.receiptData.loanNumber;

      // 3. Save image to disk (for backup/archival purposes)
      const filename = saveReceiptImage(loanNumber, receipt.image, imagesPath);

      // 4. Convert base64 image to buffer and upload to WhatsApp
      const imageBuffer = Buffer.from(receipt.image, "base64");
      logger.verbose("uploading receipt image to whatsapp", {
        paymentId: params.paymentId,
        size: imageBuffer.length,
        sizeMB: (imageBuffer.length / (1024 * 1024)).toFixed(2),
        phone: memberPhone
      });

      // Upload image to WhatsApp and get media ID
      let mediaId: string;
      try {
        mediaId = await uploadMedia(imageBuffer, "image/png");
        logger.verbose("receipt image uploaded to whatsapp", {
          paymentId: params.paymentId,
          mediaId,
          phone: memberPhone
        });
      } catch (uploadError) {
        const err = uploadError as Error;
        logger.error("failed to upload media to whatsapp", {
          paymentId: params.paymentId,
          error: err.message,
          size: imageBuffer.length
        });
        throw new Error(`Failed to upload receipt image to WhatsApp: ${err.message}`);
      }

      // 5. Send via WhatsApp using media ID (more reliable than URL)
      // IMPORTANT: Only use mediaId, never fall back to imageUrl
      logger.verbose("sending whatsapp message with mediaId", {
        paymentId: params.paymentId,
        mediaId,
        phone: memberPhone
      });

      const whatsappResponse = await sendWhatsAppMessage({
        phone: memberPhone,
        mediaId, // Use mediaId only - do not include imageUrl
        caption: `Recibo de pago - Préstamo #${loanNumber}`
      });

      const messageId = whatsappResponse.messages?.[0]?.id;

      const imageUrl = getPublicImageUrl(filename);

      logger.verbose("receipt sent via whatsapp", {
        paymentId: params.paymentId,
        loanNumber,
        messageId,
        mediaId,
        phone: memberPhone
      });

      return {
        success: true,
        messageId,
        imageUrl,
        mediaId
      };
    } catch (error) {
      const err = error as Error;
      logger.error("failed to send receipt via whatsapp", {
        paymentId: params.paymentId,
        error: err.message
      });

      return {
        success: false,
        error: err.message
      };
    }
  };

  return withErrorHandlingAndValidation(fn, sendReceiptViaWhatsAppSchema);
}
