"use client";

import { useEffect, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getTemplates, saveTemplate, deleteTemplate } from "@/lib/storage/templates";
import { formatNZD } from "@/lib/utils/currency";
import { useSubscription } from "@/hooks/useSubscription";
import type { ItemTemplate } from "@/types/quote";

interface ItemTemplatesProps {
  onSelect: (description: string, unitPrice: number) => void;
}

export function ItemTemplates({ onSelect }: ItemTemplatesProps) {
  const { limits } = useSubscription();
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<ItemTemplate[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");

  useEffect(() => {
    if (isOpen) {
      getTemplates().then(setTemplates);
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    (t: ItemTemplate) => {
      onSelect(t.description, t.unitPrice);
      setIsOpen(false);
      toast.success(`Added "${t.description}"`);
    },
    [onSelect]
  );

  const handleAddTemplate = useCallback(async () => {
    if (!newDesc.trim()) return;

    if (templates.length >= limits.templates) {
      toast.error(`Template limit reached (${limits.templates}). Upgrade to Pro for 50 templates.`);
      return;
    }

    const template: ItemTemplate = {
      id: uuidv4(),
      description: newDesc.trim(),
      unitPrice: parseFloat(newPrice) || 0,
    };

    await saveTemplate(template);
    setTemplates((prev) => [...prev, template]);
    setNewDesc("");
    setNewPrice("");
    setIsAdding(false);
    toast.success("Template saved");
  }, [newDesc, newPrice]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Group by category
  const grouped = templates.reduce<Record<string, ItemTemplate[]>>((acc, t) => {
    const cat = t.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        Templates
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-white rounded-lg shadow-lg border border-border max-h-80 overflow-y-auto">
            <div className="p-2 border-b border-border">
              <p className="text-xs font-medium text-text-muted">Quick Add from Template</p>
            </div>

            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 pt-2 pb-1">
                  {category}
                </p>
                {items.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 group"
                  >
                    <button
                      type="button"
                      className="flex-1 text-left text-sm text-text"
                      onClick={() => handleSelect(t)}
                    >
                      <span>{t.description}</span>
                      {t.unitPrice > 0 && (
                        <span className="text-text-muted ml-1 text-xs">
                          {formatNZD(t.unitPrice)}/ea
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      aria-label="Delete template"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ))}

            {/* Add new template */}
            <div className="border-t border-border p-2">
              {!isAdding ? (
                templates.length >= limits.templates ? (
                  <a
                    href="/pricing"
                    className="block w-full text-center text-xs text-amber-600 hover:text-amber-700 py-1"
                  >
                    🔒 {templates.length}/{limits.templates} templates — Upgrade for more
                  </a>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAdding(true)}
                    className="w-full text-xs text-primary"
                  >
                    + Save New Template
                  </Button>
                )
              ) : (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="e.g. Plumbing Labour"
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unit Price ($)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="0.00"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAdding(false)}
                      className="flex-1 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddTemplate}
                      className="flex-1 text-xs bg-primary hover:bg-primary-dark"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
