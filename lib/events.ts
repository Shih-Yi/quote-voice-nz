// Tiny client-side event bus for cross-component signalling that doesn't fit
// React context (e.g. a deeply-nested component telling a top-level layout to
// open the auth modal). Uses CustomEvent on window so it's SSR-safe and needs
// no provider.

export const KSQ_EVENTS = {
  AUTH_REQUIRED: "ksq:auth-required",
  PENDING_SYNCED: "ksq:pending-synced",
} as const;

export type KsqEventName = (typeof KSQ_EVENTS)[keyof typeof KSQ_EVENTS];

export function emit(name: KsqEventName, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on(name: KsqEventName, handler: (detail?: unknown) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
