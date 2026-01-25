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
import { getImagesPath, getPublicImageUrl, getWhatsAppAccessToken } from "@mikro/agents";
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
 * 4. Sends the image via WhatsApp to the provided phone (collector)
 *
 * @param deps - Dependencies including database client, receipt generator, and WhatsApp sender
 * @returns A validated function that sends receipts via WhatsApp
 */
export function createSendReceiptViaWhatsApp(deps: SendReceiptViaWhatsAppDependencies) {
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
      // Validate phone is provided
      if (!params.phone) {
        throw new Error(`Phone number is required. Payment: ${params.paymentId}`);
      }

      const recipientPhone = params.phone;

      logger.verbose("sending receipt to collector (requestor)", {
        paymentId: params.paymentId,
        recipientPhone: params.phone
      });

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
        phone: recipientPhone
      });

      // Upload image to WhatsApp and get media ID
      let mediaId: string;
      try {
        mediaId = await uploadMedia(imageBuffer, "image/png");
        logger.verbose("receipt image uploaded to whatsapp", {
          paymentId: params.paymentId,
          mediaId,
          phone: recipientPhone
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
      // Validate mediaId is present and not empty
      if (!mediaId || mediaId.trim().length === 0) {
        throw new Error(`Invalid mediaId received from upload: ${mediaId}`);
      }

      // Validate mediaId format (should be numeric string, typically 15-16 digits)
      if (!/^\d+$/.test(mediaId)) {
        throw new Error(`Invalid mediaId format (expected numeric string): ${mediaId}`);
      }

      // Small delay to ensure media is fully processed by WhatsApp
      // WhatsApp documentation says mediaId is ready immediately, but adding small buffer
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get imageUrl for response only (not for sending)
      const imageUrl = getPublicImageUrl(filename);

      logger.verbose("sending whatsapp message with mediaId", {
        paymentId: params.paymentId,
        mediaId,
        phone: recipientPhone,
        recipientType: "collector"
      });

      // CRITICAL: Explicitly construct params object with ONLY mediaId (no imageUrl)
      // This ensures WhatsApp receives only the mediaId and doesn't show a link
      const messageParams = {
        phone: recipientPhone, // Send to collector (requestor)
        mediaId: mediaId, // Only mediaId - explicitly exclude imageUrl
        caption: `Recibo de pago - Préstamo #${loanNumber}`
      };

      const whatsappResponse = await sendWhatsAppMessage(messageParams);

      const messageId = whatsappResponse.messages?.[0]?.id;

      logger.verbose("receipt sent via whatsapp", {
        paymentId: params.paymentId,
        loanNumber,
        messageId,
        mediaId,
        phone: recipientPhone,
        recipientType: "collector"
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
