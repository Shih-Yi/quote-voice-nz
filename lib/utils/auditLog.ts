import { get, set } from "idb-keyval";

const AUDIT_LOG_KEY = "ksq_audit_log";
const MAX_LOG_ENTRIES = 500;

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  entityType: "quote" | "profile" | "template" | "auth";
  entityId?: string;
  details?: string;
  userId?: string;
}

export type AuditAction =
  | "quote.created"
  | "quote.updated"
  | "quote.deleted"
  | "quote.sent"
  | "quote.accepted"
  | "quote.duplicated"
  | "quote.exported"
  | "profile.updated"
  | "template.created"
  | "template.deleted"
  | "auth.login"
  | "auth.logout"
  | "auth.signup";

export async function logAudit(
  action: AuditAction,
  entityType: AuditEntry["entityType"],
  entityId?: string,
  details?: string,
  userId?: string
): Promise<void> {
  const entries = await getAuditLog();
  entries.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId,
    details,
    userId,
  });

  // Trim to max
  if (entries.length > MAX_LOG_ENTRIES) {
    entries.length = MAX_LOG_ENTRIES;
  }

  await set(AUDIT_LOG_KEY, entries);
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  return (await get<AuditEntry[]>(AUDIT_LOG_KEY)) || [];
}

export async function clearAuditLog(): Promise<void> {
  await set(AUDIT_LOG_KEY, []);
}

export function formatAuditAction(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    "quote.created": "Quote Created",
    "quote.updated": "Quote Updated",
    "quote.deleted": "Quote Deleted",
    "quote.sent": "Quote Sent",
    "quote.accepted": "Quote Accepted",
    "quote.duplicated": "Quote Duplicated",
    "quote.exported": "Quote Exported",
    "profile.updated": "Profile Updated",
    "template.created": "Template Created",
    "template.deleted": "Template Deleted",
    "auth.login": "User Login",
    "auth.logout": "User Logout",
    "auth.signup": "User Signup",
  };
  return labels[action] || action;
}

export function getAuditActionColour(action: AuditAction): string {
  if (action.startsWith("quote.deleted")) return "text-red-600 bg-red-50";
  if (action.startsWith("quote.accepted")) return "text-green-600 bg-green-50";
  if (action.startsWith("quote.sent")) return "text-blue-600 bg-blue-50";
  if (action.startsWith("auth.")) return "text-purple-600 bg-purple-50";
  return "text-text-muted bg-gray-50";
}
