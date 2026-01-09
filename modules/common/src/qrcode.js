import QRCode from 'qrcode';

/**
 * Generate QR code as data URL
 */
export async function generateQRCode(data) {
  const qrDataUrl = await QRCode.toDataURL(data, {
    errorCorrectionLevel: 'L', // Lower error correction = less dense QR
    margin: 2,
    width: 512, // Higher resolution for better scanning
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
  
  return qrDataUrl;
}
