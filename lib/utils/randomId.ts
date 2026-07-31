// Identifiers whose unguessability is a security boundary.
//
// A quote's slug is the ONLY gate on /q/[slug]: api.get_quote_by_slug is
// SECURITY DEFINER and granted to anon, so anyone holding the slug reads the
// customer's name, phone, email and address. A device token is the sole
// ownership credential for anonymous quotes. Both used to come from
// Math.random(), which is a non-cryptographic PRNG whose internal state is
// recoverable from a handful of outputs.
//
// Slugs were also only 8 base36 characters ≈ 2^41. Finding *any* valid quote
// takes 36^8 / (number of quotes) attempts, so at 100k quotes that is ~2.8e7
// guesses — hours of work, not centuries. 16 characters ≈ 2^82.7 puts it back
// out of reach.

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** New slugs. Existing 8-character slugs stay valid — only fresh ones grow. */
export const SLUG_LENGTH = 16;

/** Accepts both legacy 8-character slugs and current 16-character ones. */
export const SLUG_PATTERN = /^[a-z0-9]{6,32}$/;

export function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG_PATTERN.test(value);
}

/**
 * Cryptographically random string over `alphabet`.
 *
 * Rejects byte values in the final, short cycle of 0–255 so that every
 * character is uniformly distributed — plain `byte % 36` would make the first
 * four letters ~1.6% more likely than the rest.
 */
// getRandomValues rejects requests over 65,536 bytes. Slugs and tokens are
// far below that, but the helper is generic so it draws in chunks.
const MAX_BYTES_PER_DRAW = 65_536;

export function randomString(
  length: number,
  alphabet: string = SLUG_ALPHABET
): string {
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  let out = "";

  while (out.length < length) {
    const wanted = Math.min(length - out.length, MAX_BYTES_PER_DRAW);
    const bytes = new Uint8Array(wanted);
    globalThis.crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte >= limit) continue;
      out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }

  return out;
}

export function generateRandomSlug(): string {
  return randomString(SLUG_LENGTH);
}

/**
 * Device token. Keeps the `dt_` prefix and 32-character body of the original
 * format so tokens already stored on devices remain valid.
 */
export function generateDeviceToken(): string {
  return `dt_${randomString(32)}`;
}
