import { get, set } from "idb-keyval";

const GST_INCLUSIVE_KEY = "ksq_default_gst_inclusive";

// NZ tradies quoting homeowners quote GST-inclusive — the price the customer
// is asked to pay is the price they pay. GST-exclusive ("+ GST") is the B2B
// convention, used when quoting builders, property managers and other GST
// registered businesses who claim it back.
//
// Our primary users quote homeowners, so inclusive is the right starting
// point. The voice flow used to hardcode exclusive, which put every voice
// quote on the B2B footing regardless of who it was for.
const DEFAULT_GST_INCLUSIVE = true;

/**
 * The GST mode new quotes start in.
 *
 * Deliberately a local preference rather than a cloud profile field: the voice
 * flow has to work offline and for anonymous users, neither of which can reach
 * /api/profile. It is seeded from DEFAULT_GST_INCLUSIVE and then tracks
 * whatever the tradie last chose, so the app settles on how they actually
 * work without asking them to configure anything.
 */
export async function getDefaultGstInclusive(): Promise<boolean> {
  try {
    const stored = await get<boolean>(GST_INCLUSIVE_KEY);
    return typeof stored === "boolean" ? stored : DEFAULT_GST_INCLUSIVE;
  } catch {
    // Storage unavailable (private mode, quota) — fall back rather than
    // block quote creation over a preference.
    return DEFAULT_GST_INCLUSIVE;
  }
}

/** Remember the tradie's choice so the next quote starts the same way. */
export async function setDefaultGstInclusive(inclusive: boolean): Promise<void> {
  try {
    await set(GST_INCLUSIVE_KEY, inclusive);
  } catch {
    // Non-fatal: the current quote already has the right value, we just
    // won't remember it next time.
  }
}

export const __testing = { GST_INCLUSIVE_KEY, DEFAULT_GST_INCLUSIVE };
