"use client"

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-6 text-6xl">📡</div>
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        You&apos;re Offline
      </h1>
      <p className="mb-8 max-w-sm text-text-muted">
        No worries mate — your saved quotes and drafts are still available
        locally. Reconnect to sync your data.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white active:bg-primary-dark"
      >
        Try Again
      </button>
    </div>
  )
}
