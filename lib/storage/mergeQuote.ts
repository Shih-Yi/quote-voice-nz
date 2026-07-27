import type { Quote } from "@/types/quote";

// Merge a winning cloud snapshot over a local quote, preserving local-only
// fields. attachments / signatureDataUrl / ownerToken exist only in
// IndexedDB — syncQuoteToSupabase never uploads them and fromSupabaseFormat
// cannot restore them, so the local copy is the single source of truth.
// Whenever a cloud snapshot replaces a local quote (hydrate on boot,
// refreshQuoteFromCloud on the editor page), these fields must be carried
// over or the user's site photos / signature / edit token silently disappear.
// Returns a new object; neither input is mutated.
export function mergeCloudQuote(local: Quote, cloud: Quote): Quote {
  return {
    ...cloud,
    ...(local.attachments !== undefined && { attachments: local.attachments }),
    ...(local.signatureDataUrl !== undefined && {
      signatureDataUrl: local.signatureDataUrl,
    }),
    ...(local.ownerToken !== undefined && { ownerToken: local.ownerToken }),
  };
}
