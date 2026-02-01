import { get, set, del, keys } from "idb-keyval";
import type { Quote } from "@/types/quote";

const QUOTES_KEY = "ksq_quotes";

export async function getAllQuotes(): Promise<Quote[]> {
  const quotes = await get<Quote[]>(QUOTES_KEY);
  return quotes || [];
}

export async function getQuoteById(id: string): Promise<Quote | undefined> {
  const quotes = await getAllQuotes();
  return quotes.find((q) => q.id === id);
}

export async function getQuoteBySlug(slug: string): Promise<Quote | undefined> {
  const quotes = await getAllQuotes();
  return quotes.find((q) => q.slug === slug);
}

export async function saveQuote(quote: Quote): Promise<void> {
  const quotes = await getAllQuotes();
  const existingIndex = quotes.findIndex((q) => q.id === quote.id);

  if (existingIndex >= 0) {
    quotes[existingIndex] = { ...quote, updatedAt: new Date().toISOString() };
  } else {
    quotes.push(quote);
  }

  await set(QUOTES_KEY, quotes);
}

export async function deleteQuote(id: string): Promise<void> {
  const quotes = await getAllQuotes();
  const filtered = quotes.filter((q) => q.id !== id);
  await set(QUOTES_KEY, filtered);
}

export async function getRecentQuotes(limit: number = 10): Promise<Quote[]> {
  const quotes = await getAllQuotes();
  return quotes
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

export async function generateSlug(): Promise<string> {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}
