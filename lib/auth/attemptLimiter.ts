const STORAGE_KEY = "ksq_auth_attempts";
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  firstAt: number;
  lockedUntil: number | null;
}

type AttemptStore = Record<string, AttemptRecord>;

function normaliseKey(action: string, identifier: string): string {
  return `${action}:${identifier.trim().toLowerCase()}`;
}

function readStore(): AttemptStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AttemptStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: AttemptStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota errors */
  }
}

export interface AttemptStatus {
  allowed: boolean;
  retryAfterSeconds: number;
  attemptsRemaining: number;
}

export function checkAttempt(action: string, identifier: string): AttemptStatus {
  if (!identifier) {
    return { allowed: true, retryAfterSeconds: 0, attemptsRemaining: MAX_ATTEMPTS };
  }
  const key = normaliseKey(action, identifier);
  const store = readStore();
  const record = store[key];
  const now = Date.now();

  if (!record) {
    return { allowed: true, retryAfterSeconds: 0, attemptsRemaining: MAX_ATTEMPTS };
  }

  if (record.lockedUntil && record.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000),
      attemptsRemaining: 0,
    };
  }

  if (now - record.firstAt > WINDOW_MS) {
    return { allowed: true, retryAfterSeconds: 0, attemptsRemaining: MAX_ATTEMPTS };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - record.count),
  };
}

export function recordFailure(action: string, identifier: string): AttemptStatus {
  if (!identifier) {
    return { allowed: true, retryAfterSeconds: 0, attemptsRemaining: MAX_ATTEMPTS };
  }
  const key = normaliseKey(action, identifier);
  const store = readStore();
  const now = Date.now();
  const existing = store[key];

  const withinWindow = existing && now - existing.firstAt <= WINDOW_MS;
  const nextCount = withinWindow ? existing.count + 1 : 1;
  const firstAt = withinWindow ? existing.firstAt : now;
  const locked = nextCount >= MAX_ATTEMPTS;

  const next: AttemptRecord = {
    count: nextCount,
    firstAt,
    lockedUntil: locked ? now + LOCKOUT_MS : null,
  };

  store[key] = next;
  writeStore(store);

  return {
    allowed: !locked,
    retryAfterSeconds: locked ? Math.ceil(LOCKOUT_MS / 1000) : 0,
    attemptsRemaining: locked ? 0 : Math.max(0, MAX_ATTEMPTS - nextCount),
  };
}

export function clearAttempts(action: string, identifier: string): void {
  if (!identifier) return;
  const key = normaliseKey(action, identifier);
  const store = readStore();
  if (store[key]) {
    delete store[key];
    writeStore(store);
  }
}

export function formatRetryAfter(seconds: number): string {
  if (seconds <= 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
