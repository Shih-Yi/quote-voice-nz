import { get, set } from "idb-keyval";

const DEVICE_TOKEN_KEY = "ksq_device_token";

// Generate a random device token (one per device/browser)
function generateDeviceToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "dt_";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Get or create device token (singleton per device)
export async function getDeviceToken(): Promise<string> {
  let token = await get<string>(DEVICE_TOKEN_KEY);

  if (!token) {
    token = generateDeviceToken();
    await set(DEVICE_TOKEN_KEY, token);
  }

  return token;
}

// Check if device has a token (for UI purposes)
export async function hasDeviceToken(): Promise<boolean> {
  const token = await get<string>(DEVICE_TOKEN_KEY);
  return Boolean(token);
}
