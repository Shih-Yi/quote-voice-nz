"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNZD } from "@/lib/utils/currency";
import type { Quote, LineItem } from "@/types/quote";

interface QuoteVersionDiffProps {
  older: Quote;
  newer: Quote;
}

interface FieldDiff {
  label: string;
  oldValue: string;
  newValue: string;
}

interface ItemDiff {
  type: "added" | "removed" | "changed" | "unchanged";
  item: LineItem;
  oldItem?: LineItem;
}

export function QuoteVersionDiff({ older, newer }: QuoteVersionDiffProps) {
  const fieldDiffs = useMemo(() => {
    const diffs: FieldDiff[] = [];

    const fields: { key: keyof Quote; label: string }[] = [
      { key: "customerName", label: "Customer Name" },
      { key: "customerPhone", label: "Phone" },
      { key: "customerEmail", label: "Email" },
      { key: "customerAddress", label: "Address" },
      { key: "notes", label: "Notes" },
    ];

    for (const { key, label } of fields) {
      const oldVal = String(older[key] || "");
      const newVal = String(newer[key] || "");
      if (oldVal !== newVal) {
        diffs.push({ label, oldValue: oldVal, newValue: newVal });
      }
    }

    if (older.gstInclusive !== newer.gstInclusive) {
      diffs.push({
        label: "GST Mode",
        oldValue: older.gstInclusive ? "Inclusive" : "Exclusive",
        newValue: newer.gstInclusive ? "Inclusive" : "Exclusive",
      });
    }

    return diffs;
  }, [older, newer]);

  const itemDiffs = useMemo(() => {
    const diffs: ItemDiff[] = [];
    const olderMap = new Map(older.items.map((i) => [i.description, i]));
    const newerMap = new Map(newer.items.map((i) => [i.description, i]));

    // Check newer items
    for (const item of newer.items) {
      const oldItem = olderMap.get(item.description);
      if (!oldItem) {
        diffs.push({ type: "added", item });
      } else if (
        oldItem.quantity !== item.quantity ||
        oldItem.unitPrice !== item.unitPrice
      ) {
        diffs.push({ type: "changed", item, oldItem });
      } else {
        diffs.push({ type: "unchanged", item });
      }
    }

    // Check removed items
    for (const item of older.items) {
      if (!newerMap.has(item.description)) {
        diffs.push({ type: "removed", item });
      }
    }

    return diffs;
  }, [older, newer]);

  const totalChanged = older.total !== newer.total;
  const hasChanges = fieldDiffs.length > 0 || itemDiffs.some((d) => d.type !== "unchanged") || totalChanged;

  if (!hasChanges) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-text-muted">
          No changes between V{older.version || 1} and V{newer.version || 1}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
          V{older.version || 1}
        </span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
          V{newer.version || 1}
        </span>
      </div>

      {/* Field changes */}
      {fieldDiffs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-text-muted">Detail Changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fieldDiffs.map((diff) => (
              <div key={diff.label} className="text-sm">
                <p className="font-medium text-text mb-1">{diff.label}</p>
                <div className="flex flex-col gap-1">
                  {diff.oldValue && (
                    <p className="bg-red-50 text-red-700 px-2 py-1 rounded line-through text-xs">
                      {diff.oldValue}
                    </p>
                  )}
                  {diff.newValue && (
                    <p className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                      {diff.newValue}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Item changes */}
      {itemDiffs.some((d) => d.type !== "unchanged") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-text-muted">Item Changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {itemDiffs
              .filter((d) => d.type !== "unchanged")
              .map((diff, i) => (
                <div
                  key={i}
                  className={`text-sm p-2 rounded ${
                    diff.type === "added"
                      ? "bg-green-50 border border-green-200"
                      : diff.type === "removed"
                      ? "bg-red-50 border border-red-200"
                      : "bg-amber-50 border border-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${
                      diff.type === "added" ? "text-green-600" :
                      diff.type === "removed" ? "text-red-600" : "text-amber-600"
                    }`}>
                      {diff.type === "added" ? "+" : diff.type === "removed" ? "−" : "~"}
                    </span>
                    <span className="font-medium text-text">{diff.item.description}</span>
                  </div>
                  {diff.type === "changed" && diff.oldItem && (
                    <div className="mt-1 ml-5 text-xs text-text-muted">
                      {diff.oldItem.quantity !== diff.item.quantity && (
                        <span>Qty: {diff.oldItem.quantity} → {diff.item.quantity}  </span>
                      )}
                      {diff.oldItem.unitPrice !== diff.item.unitPrice && (
                        <span>Price: {formatNZD(diff.oldItem.unitPrice)} → {formatNZD(diff.item.unitPrice)}</span>
                      )}
                    </div>
                  )}
                  {diff.type !== "changed" && (
                    <p className="ml-5 text-xs text-text-muted">
                      {diff.item.quantity} × {formatNZD(diff.item.unitPrice)}
                    </p>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Total change */}
      {totalChanged && (
        <Card>
          <CardContent className="py-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">Total</span>
              <div className="flex items-center gap-2">
                <span className="text-red-500 line-through">{formatNZD(older.total)}</span>
                <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className="font-bold text-text">{formatNZD(newer.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
