/**
 * Extraction confidence below this puts the quote into validation mode:
 * the editor flags it and asks the tradie to check the figures before
 * sending. Defined by the error-handling policy in CLAUDE.md.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface UserProfile {
  id?: string;
  fullName?: string;
  avatarUrl?: string;
  businessName?: string;
  phone?: string;
  email?: string;
  address?: string;
  bankAccount?: string;
  gstNumber?: string;
}

export interface Quote {
  id: string;
  slug?: string;
  ownerToken?: string;  // Secret token for edit/delete (only stored locally)
  userId?: string;      // Linked user ID (if registered)
  
  // Provider info (Snapshot of business details at time of quote)
  providerDetails?: UserProfile; 
  
  parentId?: string;    // For version tracking (if duplicated from another quote)
  version?: number;     // Version number (1, 2, 3...)
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  items: LineItem[];
  notes?: string;
  gstInclusive: boolean;
  subtotal: number;
  gst: number;
  total: number;
  status: "draft" | "sent" | "accepted";
  createdAt: string;
  updatedAt: string;
  // Tombstone timestamp — set when user deletes; physical purge happens after
  // cloud deletion is confirmed. Tombstoned quotes are hidden from all lists.
  deletedAt?: string;
  // Last time this quote was confirmed to exist in Supabase. Absent means the
  // cloud has never seen it, which lets deleteQuote skip the cloud round trip
  // instead of leaving an orphan row behind, and lets share UI tell whether a
  // public link will actually resolve for the customer.
  cloudSyncedAt?: string;
  ownerProfile?: UserProfile;  // Fetched from Supabase for public quote views

  // Rich content
  signatureDataUrl?: string;   // Customer signature (PNG data URL)
  attachments?: QuoteAttachment[];  // Site photos / documents

  // Watermark flag — true when quote creator is on free tier
  showWatermark?: boolean;
  // Quote creator's subscription tier, resolved from the cloud on public views.
  // Drives whether the customer is offered online acceptance. Undefined means
  // "not resolved yet" (offline, or a local-only quote).
  ownerTier?: "free" | "pro" | "team";

  // AI extraction confidence (0–1) for voice-created quotes. Below
  // LOW_CONFIDENCE_THRESHOLD the editor shows a validation banner. Cleared
  // once the tradie confirms the details, and absent on manually-typed quotes.
  extractionConfidence?: number;
}

export interface QuoteAttachment {
  id: string;
  name: string;
  dataUrl: string;   // Base64 data URL (stored in IndexedDB)
  mimeType: string;
  size: number;       // bytes
  createdAt: string;
}

export interface ItemTemplate {
  id: string;
  description: string;
  unitPrice: number;
  category?: string;
}

export interface PendingAudio {
  id: string;
  blob: Blob;
  createdAt: string;
  retryCount: number;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
}

export interface ExtractionResult {
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  items: Omit<LineItem, "id" | "total">[];
  notes: string | null;
  confidence: number;
}
