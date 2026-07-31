import { get, set } from "idb-keyval";
import { generateDeviceToken } from "@/lib/utils/randomId";

const DEVICE_TOKEN_KEY = "ksq_device_token";

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
