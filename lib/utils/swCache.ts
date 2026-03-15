/**
 * Ask the service worker to pre-cache a quote's public page for offline viewing.
 */
export function preCacheQuotePage(slug: string): void {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !navigator.serviceWorker.controller
  ) {
    return;
  }

  const url = `${window.location.origin}/q/${slug}`;
  navigator.serviceWorker.controller.postMessage({
    type: "CACHE_QUOTE",
    url,
  });
}
