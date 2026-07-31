// Haptic feedback for the voice flow.
//
// CLAUDE.md's error-handling spec calls for a short vibration when speech
// recognition fails: the tradie is holding the phone one-handed on a noisy
// site and may not be looking at the screen, so a toast alone is easy to miss.
//
// Vibration API support is patchy — Safari on iOS does not implement it at
// all — so every call is best-effort and silent when unsupported.

type VibratePattern = number | number[];

function vibrate(pattern: VibratePattern): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when the document is not focused. Never let
    // feedback break the flow that triggered it.
  }
}

/** Recording started or stopped — a single short pulse. */
export function hapticTap(): void {
  vibrate(30);
}

/** Speech recognition or extraction failed — two pulses, distinctly "wrong". */
export function hapticError(): void {
  vibrate([60, 50, 60]);
}

/** Quote created — one longer pulse. */
export function hapticSuccess(): void {
  vibrate(80);
}
