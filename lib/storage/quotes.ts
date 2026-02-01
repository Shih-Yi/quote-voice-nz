import { get, set } from "idb-keyval";
import type { Quote } from "@/types/quote";
import {
  saveQuoteToSupabase,
  updateQuoteInSupabase,
  deleteQuoteFromSupabase,
  getQuoteBySlugFromSupabase,
  getQuoteByIdFromSupabase,
} from "@/lib/supabase/quotes";
import { getDeviceToken } from "./deviceToken";

const QUOTES_KEY = "ksq_quotes";

// Get all quotes from local storage
export async function getAllQuotes(): Promise<Quote[]> {
  const quotes = await get<Quote[]>(QUOTES_KEY);
  return quotes || [];
}

// Get quote by ID (local only)
export async function getQuoteById(id: string): Promise<Quote | undefined> {
  const quotes = await getAllQuotes();
  return quotes.find((q) => q.id === id);
}

// Fetch latest quote from cloud and update local storage
export async function refreshQuoteFromCloud(id: string): Promise<Quote | null> {
  const cloudQuote = await getQuoteByIdFromSupabase(id);
  if (!cloudQuote) return null;

  const quotes = await getAllQuotes();
  const index = quotes.findIndex((q) => q.id === id);

  if (index >= 0) {
    quotes[index] = cloudQuote;
  } else {
    quotes.push(cloudQuote);
  }

  await set(QUOTES_KEY, quotes);
  return cloudQuote;
}

// Get quote by slug - try Supabase first (for public sharing), fallback to local
export async function getQuoteBySlug(slug: string): Promise<Quote | undefined> {
  // Try Supabase first (for shared links)
  const cloudQuote = await getQuoteBySlugFromSupabase(slug);
  if (cloudQuote) {
    return cloudQuote;
  }

  // Fallback to local
  const quotes = await getAllQuotes();
  return quotes.find((q) => q.slug === slug);
}

// Save NEW quote - local first, then sync to Supabase
export async function saveQuote(quote: Quote): Promise<{ synced: boolean }> {
  // Get device token (same for all quotes on this device)
  const deviceToken = await getDeviceToken();

  // 1. Save locally first (offline-first)
  const quotes = await getAllQuotes();
  const updatedQuote = { ...quote, updatedAt: new Date().toISOString() };
  quotes.push(updatedQuote);
  await set(QUOTES_KEY, quotes);

  // 2. Try to sync to Supabase (non-blocking)
  const result = await saveQuoteToSupabase(updatedQuote, deviceToken);

  return { synced: result.success };
}

// Update EXISTING quote - local first, then sync to Supabase
// Note: Only works for "draft" status quotes
export async function updateQuote(quote: Quote): Promise<{ synced: boolean; error?: string }> {
  // Check if quote is locked (sent/accepted)
  if (quote.status !== "draft") {
    return { synced: false, error: "Cannot edit sent quotes. Please duplicate instead." };
  }

  // 1. Update locally
  const quotes = await getAllQuotes();
  const existingIndex = quotes.findIndex((q) => q.id === quote.id);

  const updatedQuote = { ...quote, updatedAt: new Date().toISOString() };

  if (existingIndex >= 0) {
    quotes[existingIndex] = updatedQuote;
  } else {
    quotes.push(updatedQuote);
  }

  await set(QUOTES_KEY, quotes);

  // 2. Get device token and sync to Supabase
  const deviceToken = await getDeviceToken();
  const result = await updateQuoteInSupabase(updatedQuote, deviceToken);

  return { synced: result.success, error: result.error };
}

// Mark quote as sent (locks the quote)
export async function markQuoteAsSent(quoteId: string): Promise<{ synced: boolean }> {
  const quotes = await getAllQuotes();
  const index = quotes.findIndex((q) => q.id === quoteId);

  if (index < 0) {
    return { synced: false };
  }

  const updatedQuote = {
    ...quotes[index],
    status: "sent" as const,
    updatedAt: new Date().toISOString(),
  };

  quotes[index] = updatedQuote;
  await set(QUOTES_KEY, quotes);

  // Sync to Supabase
  const deviceToken = await getDeviceToken();
  const result = await updateQuoteInSupabase(updatedQuote, deviceToken);

  return { synced: result.success };
}

// Duplicate a quote (for editing sent quotes)
export async function duplicateQuote(quoteId: string): Promise<Quote | null> {
  const quotes = await getAllQuotes();
  const original = quotes.find((q) => q.id === quoteId);

  if (!original) {
    return null;
  }

  // Create new quote with new ID and slug
  const newQuote: Quote = {
    ...original,
    id: crypto.randomUUID(),
    slug: await generateSlug(),
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save the duplicate
  await saveQuote(newQuote);

  return newQuote;
}

// Delete quote - local and Supabase
export async function deleteQuote(id: string): Promise<void> {
  // Delete locally
  const quotes = await getAllQuotes();
  const filtered = quotes.filter((q) => q.id !== id);
  await set(QUOTES_KEY, filtered);

  // Get device token and try to delete from Supabase
  const deviceToken = await getDeviceToken();
  await deleteQuoteFromSupabase(id, deviceToken);
}

// Get recent quotes (local)
export async function getRecentQuotes(limit: number = 10): Promise<Quote[]> {
  const quotes = await getAllQuotes();
  return quotes
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

// Generate unique slug
export async function generateSlug(): Promise<string> {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

// Count quotes on this device
export async function countLocalQuotes(): Promise<number> {
  const quotes = await getAllQuotes();
  return quotes.length;
}
