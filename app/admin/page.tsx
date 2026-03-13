"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { getAllQuotes, countLocalQuotes } from "@/lib/storage/quotes";
import { getTemplates } from "@/lib/storage/templates";
import { getAuditLog, clearAuditLog, formatAuditAction, getAuditActionColour, type AuditEntry } from "@/lib/utils/auditLog";
import { formatNZDateTime } from "@/lib/utils/date";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState({
    localQuotes: 0,
    templates: 0,
    auditEntries: 0,
    storageEstimate: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [logFilter, setLogFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    try {
      const [log, quoteCount, templates] = await Promise.all([
        getAuditLog(),
        countLocalQuotes(),
        getTemplates(),
      ]);

      setAuditLog(log);

      // Estimate storage
      let storageEstimate = "Unknown";
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        if (est.usage) {
          storageEstimate = `${(est.usage / 1024 / 1024).toFixed(1)} MB`;
        }
      }

      setStats({
        localQuotes: quoteCount,
        templates: templates.length,
        auditEntries: log.length,
        storageEstimate,
      });
    } catch (error) {
      console.error("Failed to load admin data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearLog = useCallback(async () => {
    if (!confirm("Clear all audit log entries?")) return;
    await clearAuditLog();
    setAuditLog([]);
    setStats((prev) => ({ ...prev, auditEntries: 0 }));
    toast.success("Audit log cleared");
  }, []);

  const filteredLog = logFilter === "all"
    ? auditLog
    : auditLog.filter((e) => e.entityType === logFilter);

  if (isLoading) {
    return (
      <MobileShell>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-text-muted hover:text-text">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-text">Admin Panel</h1>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-text-muted">Current User</CardTitle>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-1">
                <p className="font-medium text-text">{user.email}</p>
                <p className="text-xs text-text-muted">ID: {user.id}</p>
                <p className="text-xs text-text-muted">
                  Created: {formatNZDateTime(user.created_at)}
                </p>
              </div>
            ) : (
              <p className="text-text-muted text-sm">Not logged in</p>
            )}
          </CardContent>
        </Card>

        {/* System Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-text-muted">System Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Local Quotes", value: stats.localQuotes },
                { label: "Item Templates", value: stats.templates },
                { label: "Audit Entries", value: stats.auditEntries },
                { label: "Storage Used", value: stats.storageEstimate },
              ].map((s) => (
                <div key={s.label} className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-text">{s.value}</p>
                  <p className="text-[10px] text-text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-text-muted">Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/quotes" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Quote Management
              </Button>
            </Link>
            <Link href="/revenue" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Revenue Dashboard
              </Button>
            </Link>
            <Link href="/settings" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Business Settings
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-text-muted">Audit Log</CardTitle>
              {auditLog.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearLog} className="text-xs text-red-400">
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Log Filters */}
            <div className="flex gap-1 mb-3 overflow-x-auto">
              {["all", "quote", "profile", "template", "auth"].map((f) => (
                <Button
                  key={f}
                  variant={logFilter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLogFilter(f)}
                  className={`text-xs h-6 px-2 ${logFilter === f ? "bg-primary" : ""}`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>

            {filteredLog.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-4">No activity recorded</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredLog.slice(0, 50).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 text-xs">
                    <Badge
                      variant="outline"
                      className={`text-[9px] flex-shrink-0 ${getAuditActionColour(entry.action)}`}
                    >
                      {formatAuditAction(entry.action)}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      {entry.details && (
                        <p className="text-text truncate">{entry.details}</p>
                      )}
                      <p className="text-[10px] text-text-muted">
                        {formatNZDateTime(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                {filteredLog.length > 50 && (
                  <p className="text-[10px] text-text-muted text-center">
                    Showing 50 of {filteredLog.length} entries
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MobileShell>
  );
}
