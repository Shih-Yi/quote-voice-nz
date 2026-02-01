"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNZD } from "@/lib/utils/currency";
import type { LineItem } from "@/types/quote";

interface QuoteItemProps {
  item: LineItem;
  editable?: boolean;
  onUpdate?: (item: LineItem) => void;
  onDelete?: (id: string) => void;
}

export function QuoteItem({ item, editable = false, onUpdate, onDelete }: QuoteItemProps) {
  const handleChange = (field: keyof LineItem, value: string | number) => {
    if (!onUpdate) return;

    const updated = { ...item };

    if (field === "description") {
      updated.description = value as string;
    } else if (field === "quantity") {
      const qty = Math.max(0, parseFloat(value as string) || 0);
      updated.quantity = qty;
      updated.total = qty * updated.unitPrice;
    } else if (field === "unitPrice") {
      const price = Math.max(0, parseFloat(value as string) || 0);
      updated.unitPrice = price;
      updated.total = updated.quantity * price;
    }

    onUpdate(updated);
  };

  if (editable) {
    return (
      <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-border">
        <div className="flex items-start gap-2">
          <Input
            value={item.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Description"
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete?.(item.id)}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>
        <div className="flex gap-2">
          <div className="w-20">
            <Input
              type="number"
              inputMode="decimal"
              value={item.quantity}
              onChange={(e) => handleChange("quantity", e.target.value)}
              placeholder="Qty"
              min="0"
              step="0.01"
              className="text-center"
            />
          </div>
          <span className="text-text-muted self-center">×</span>
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
              <Input
                type="number"
                inputMode="decimal"
                value={item.unitPrice}
                onChange={(e) => handleChange("unitPrice", e.target.value)}
                placeholder="Price"
                min="0"
                step="0.01"
                className="pl-7"
              />
            </div>
          </div>
          <div className="w-24 flex items-center justify-end font-medium text-text">
            {formatNZD(item.total)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-start py-2 border-b border-border last:border-0">
      <div className="flex-1">
        <p className="text-text">{item.description}</p>
        <p className="text-sm text-text-muted">
          {item.quantity} × {formatNZD(item.unitPrice)}
        </p>
      </div>
      <span className="font-medium text-text">{formatNZD(item.total)}</span>
    </div>
  );
}
