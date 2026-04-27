"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { deleteQuote } from "@/lib/storage/quotes";
import { formatNZD } from "@/lib/utils/currency";
import { formatNZDate } from "@/lib/utils/date";
import type { Quote } from "@/types/quote";

interface BulkQuoteActionsProps {
  quotes: Quote[];
  onComplete: () => void;
}

export function BulkQuoteActions({ quotes, onComplete }: BulkQuoteActionsProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(quotes.map((q) => q.id)));
  }, [quotes]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isDeletable = useCallback(
    (q: Quote) => q.status !== "sent" && q.status !== "accepted",
    []
  );

  const deletableSelectedIds = useCallback(() => {
    const deletable = new Set(quotes.filter(isDeletable).map((q) => q.id));
    return Array.from(selectedIds).filter((id) => deletable.has(id));
  }, [quotes, selectedIds, isDeletable]);

  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    const ids = deletableSelectedIds();
    const skipped = selectedIds.size - ids.length;
    let deleted = 0;
    for (const id of ids) {
      try {
        await deleteQuote(id);
        deleted++;
      } catch (e) {
        console.error(`Failed to delete ${id}:`, e);
      }
    }
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    setSelectedIds(new Set());
    setIsSelecting(false);
    if (skipped > 0) {
      toast.success(
        `Deleted ${deleted} quote(s); skipped ${skipped} sent/accepted quote(s)`
      );
    } else {
      toast.success(`Deleted ${deleted} quote(s)`);
    }
    onComplete();
  }, [selectedIds, onComplete, deletableSelectedIds]);

  const handleExportCsv = useCallback(() => {
    const selected = quotes.filter((q) => selectedIds.has(q.id));
    if (selected.length === 0) {
      toast.error("No quotes selected");
      return;
    }

    const headers = ["Date", "Customer", "Status", "Subtotal", "GST", "Total", "Items"];
    const rows = selected.map((q) => [
      formatNZDate(q.createdAt),
      `"${q.customerName.replace(/"/g, '""')}"`,
      q.status,
      q.subtotal.toFixed(2),
      q.gst.toFixed(2),
      q.total.toFixed(2),
      `"${q.items.map((i) => `${i.description} x${i.quantity}`).join("; ").replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quotes-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selected.length} quote(s) to CSV`);
  }, [quotes, selectedIds]);

  if (!isSelecting) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsSelecting(true)}
        className="text-text-muted text-xs"
      >
        Select
      </Button>
    );
  }

  return (
    <>
      {/* Selection toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-muted">
          {selectedIds.size} selected
        </span>
        <Button variant="ghost" size="sm" onClick={selectedIds.size === quotes.length ? deselectAll : selectAll} className="text-xs h-7 px-2">
          {selectedIds.size === quotes.length ? "Deselect All" : "Select All"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExportCsv}
          disabled={selectedIds.size === 0}
          className="text-xs h-7 px-2 text-primary"
        >
          Export CSV
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deletableSelectedIds().length === 0}
          className="text-xs h-7 px-2 text-red-500"
          title={
            deletableSelectedIds().length === 0 && selectedIds.size > 0
              ? "Sent/accepted quotes cannot be deleted"
              : undefined
          }
        >
          Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }} className="text-xs h-7 px-2">
          Cancel
        </Button>
      </div>

      {/* Selection checkboxes overlay via render prop */}
      {isSelecting && quotes.map((q) => (
        <input
          key={q.id}
          type="checkbox"
          checked={selectedIds.has(q.id)}
          onChange={() => toggleSelect(q.id)}
          className="hidden"
          data-quote-select={q.id}
        />
      ))}

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deletableSelectedIds().length} quote(s)?</DialogTitle>
            <DialogDescription>
              This will permanently remove the selected draft quotes. This action cannot be undone.
              {selectedIds.size - deletableSelectedIds().length > 0 && (
                <span className="block mt-2 text-amber-600">
                  {selectedIds.size - deletableSelectedIds().length} sent/accepted quote(s) will be skipped — they cannot be deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto space-y-1 my-2">
            {quotes
              .filter((q) => selectedIds.has(q.id) && isDeletable(q))
              .map((q) => (
                <div key={q.id} className="flex justify-between text-sm text-text-muted px-1">
                  <span>{q.customerName}</span>
                  <span>{formatNZD(q.total)}</span>
                </div>
              ))}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleBulkDelete}
              disabled={isDeleting || deletableSelectedIds().length === 0}
              className="w-full bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? "Deleting..." : `Delete ${deletableSelectedIds().length} Quote(s)`}
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="w-full">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Selectable wrapper for QuoteListItem
interface SelectableQuoteProps {
  quoteId: string;
  isSelecting: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

export function SelectableQuote({ quoteId, isSelecting, isSelected, onToggle, children }: SelectableQuoteProps) {
  if (!isSelecting) return <>{children}</>;

  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(quoteId)}
        className="w-5 h-5 rounded border-border text-primary accent-primary flex-shrink-0"
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}
