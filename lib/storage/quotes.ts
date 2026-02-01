import { get, set } from "idb-keyval";
import type { Quote } from "@/types/quote";
import {
  saveQuoteToSupabase,
  updateQuoteInSupabase,
  deleteQuoteFromSupabase,
  getQuoteBySlugFromSupabase,
} from "@/lib/supabase/quotes";
import {
  generateOwnerToken,
  saveOwnerToken,
  getOwnerToken,
  removeOwnerToken,
} from "./ownerTokens";

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
export async function saveQuote(quote: Quote): Promise<{ synced: boolean; ownerToken: string }> {
  // Generate owner token for new quote
  const ownerToken = generateOwnerToken();

  // 1. Save locally first (offline-first)
  const quotes = await getAllQuotes();
  const updatedQuote = { ...quote, updatedAt: new Date().toISOString() };
  quotes.push(updatedQuote);
  await set(QUOTES_KEY, quotes);

  // 2. Save owner token locally
  await saveOwnerToken(quote.id, ownerToken);

  // 3. Try to sync to Supabase (non-blocking)
  const result = await saveQuoteToSupabase(updatedQuote, ownerToken);

  return { synced: result.success, ownerToken };
}

// Update EXISTING quote - local first, then sync to Supabase
export async function updateQuote(quote: Quote): Promise<{ synced: boolean }> {
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

  // 2. Get owner token and sync to Supabase
  const ownerToken = await getOwnerToken(quote.id);
  if (ownerToken) {
    const result = await updateQuoteInSupabase(updatedQuote, ownerToken);
    return { synced: result.success };
  }

  return { synced: false };
}

// Delete quote - local and Supabase
export async function deleteQuote(id: string): Promise<void> {
  // Delete locally
  const quotes = await getAllQuotes();
  const filtered = quotes.filter((q) => q.id !== id);
  await set(QUOTES_KEY, filtered);

  // Get owner token and try to delete from Supabase
  const ownerToken = await getOwnerToken(id);
  if (ownerToken) {
    await deleteQuoteFromSupabase(id, ownerToken);
    await removeOwnerToken(id);
  }
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

// Check if current user owns a quote
export async function isOwner(quoteId: string): Promise<boolean> {
  const token = await getOwnerToken(quoteId);
  return Boolean(token);
}
