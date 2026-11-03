import QRCode from 'qrcode';

export function getAppBaseUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://192.168.50.143';
}

export function getRoomPermanentUrl(roomId?: string): string {
  const baseUrl = getAppBaseUrl().replace(/\/$/, '');
  return roomId ? `${baseUrl}/room/${roomId}` : baseUrl;
}

export async function generateRoomQrDataUrl(roomId?: string): Promise<string> {
  const url = getRoomPermanentUrl(roomId);
  return await QRCode.toDataURL(url, {
    width: 480,
    margin: 2,
    color: {
      dark: '#0B1F3A',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });
}

export async function generateRoomQrSvg(roomId?: string): Promise<string> {
  const url = getRoomPermanentUrl(roomId);
  return await QRCode.toString(url, {
    type: 'svg',
    width: 480,
    margin: 2,
    color: {
      dark: '#0B1F3A',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });
}

// Aliases for camelCase conventions
export const generateRoomQRCodeDataUrl = generateRoomQrDataUrl;
export const generateRoomQRCodeSvg = generateRoomQrSvg;
