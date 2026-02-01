import { get, set } from "idb-keyval";

const OWNER_TOKENS_KEY = "ksq_owner_tokens";

interface OwnerTokenMap {
  [quoteId: string]: string;
}

// Generate a random owner token
export function generateOwnerToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "ot_";
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Get all owner tokens from localStorage
async function getOwnerTokens(): Promise<OwnerTokenMap> {
  const tokens = await get<OwnerTokenMap>(OWNER_TOKENS_KEY);
  return tokens || {};
}

// Save owner token for a quote
export async function saveOwnerToken(quoteId: string, token: string): Promise<void> {
  const tokens = await getOwnerTokens();
  tokens[quoteId] = token;
  await set(OWNER_TOKENS_KEY, tokens);
}

// Get owner token for a quote
export async function getOwnerToken(quoteId: string): Promise<string | undefined> {
  const tokens = await getOwnerTokens();
  return tokens[quoteId];
}

// Check if user owns the quote
export async function isQuoteOwner(quoteId: string): Promise<boolean> {
  const token = await getOwnerToken(quoteId);
  return Boolean(token);
}

// Remove owner token (when quote is deleted)
export async function removeOwnerToken(quoteId: string): Promise<void> {
  const tokens = await getOwnerTokens();
  delete tokens[quoteId];
  await set(OWNER_TOKENS_KEY, tokens);
}

// Get all quote IDs that user owns
export async function getOwnedQuoteIds(): Promise<string[]> {
  const tokens = await getOwnerTokens();
  return Object.keys(tokens);
}

// Get all owner tokens (for binding to user after registration)
export async function getAllOwnerTokens(): Promise<string[]> {
  const tokens = await getOwnerTokens();
  return Object.values(tokens);
}
