"use client";

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { QuoteItem } from "./QuoteItem";
import { ProviderInfo } from "./ProviderInfo";
import { formatNZD } from "@/lib/utils/currency";
import { calculateQuoteTotals } from "@/lib/utils/gst";
import type { Quote, LineItem, UserProfile } from "@/types/quote";

interface QuoteFormProps {
  quote: Quote;
  onSave: (quote: Quote, updateProfile?: boolean) => void;
  onShowAuthModal?: () => void; // New prop
}

export function QuoteForm({ quote: initialQuote, onSave, onShowAuthModal }: QuoteFormProps) {
  const [quote, setQuote] = useState<Quote>(initialQuote);
  const [gstInclusive, setGstInclusive] = useState(initialQuote.gstInclusive);
  const [shouldUpdateProfile, setShouldUpdateProfile] = useState(false); // New state

  const updateTotals = useCallback(
    (items: LineItem[], inclusive: boolean) => {
      const { subtotal, gst, total } = calculateQuoteTotals(items, inclusive);
      return { subtotal, gst, total };
    },
    []
  );

  const handleFieldChange = useCallback(
    (field: keyof Quote, value: string) => {
      setQuote((prev) => ({
        ...prev,
        [field]: value,
        updatedAt: new Date().toISOString(),
      }));
    },
    []
  );

  const handleProviderUpdate = useCallback((details: UserProfile) => {
    setQuote((prev) => ({n      ...prev,
      providerDetails: details,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleProfileUpdateCheckbox = useCallback((checked: boolean) => {
    setShouldUpdateProfile(checked);
  }, []);

  const handleItemUpdate = useCallback(
    (updatedItem: LineItem) => {
      setQuote((prev) => {
        const items = prev.items.map((item) =>
          item.id === updatedItem.id ? updatedItem : item
        );
        const totals = updateTotals(items, gstInclusive);
        return {
          ...prev,
          items,
          ...totals,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [gstInclusive, updateTotals]
  );

  const handleItemDelete = useCallback(
    (id: string) => {
      setQuote((prev) => {
        const items = prev.items.filter((item) => item.id !== id);
        const totals = updateTotals(items, gstInclusive);
        return {
          ...prev,
          items,
          ...totals,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [gstInclusive, updateTotals]
  );

  const handleAddItem = useCallback(() => {
    const newItem: LineItem = {
      id: uuidv4(),
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    setQuote((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleGstToggle = useCallback(() => {
    setGstInclusive((prev) => {
      const newValue = !prev;
      setQuote((prevQuote) => {
        const totals = updateTotals(prevQuote.items, newValue);
        return {
          ...prevQuote,
          gstInclusive: newValue,
          ...totals,
          updatedAt: new Date().toISOString(),
        };
      });
      return newValue;
    });
  }, [updateTotals]);

  const handleSave = useCallback(() => {
    onSave(quote, shouldUpdateProfile);
  }, [quote, shouldUpdateProfile, onSave]);

  return (
    <div className="flex flex-col gap-4">
      {/* Provider Details (My Business) */}
      <ProviderInfo 
        providerDetails={quote.providerDetails} 
        onChange={handleProviderUpdate} 
        onUpdateProfile={handleProfileUpdateCheckbox}
        onShowAuthModal={onShowAuthModal}
      />

      {/* Customer Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Customer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="customerName">Name</Label>
            <Input
              id="customerName"
              value={quote.customerName}
              onChange={(e) => handleFieldChange("customerName", e.target.value)}
              placeholder="Customer name"
            />
          </div>
          <div>
            <Label htmlFor="customerPhone">Phone</Label>
            <Input
              id="customerPhone"
              type="tel"
              inputMode="tel"
              value={quote.customerPhone || ""}
              onChange={(e) => handleFieldChange("customerPhone", e.target.value)}
              placeholder="Phone number"
            />
          </div>
          <div>
            <Label htmlFor="customerEmail">Email</Label>
            <Input
              id="customerEmail"
              type="email"
              inputMode="email"
              value={quote.customerEmail || ""}
              onChange={(e) => handleFieldChange("customerEmail", e.target.value)}
              placeholder="Email address"
            />
          </div>
          <div>
            <Label htmlFor="customerAddress">Address</Label>
            <Textarea
              id="customerAddress"
              value={quote.customerAddress || ""}
              onChange={(e) => handleFieldChange("customerAddress", e.target.value)}
              placeholder="Street address, suburb, city"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Quote Items</CardTitle>
            <Button size="sm" variant="outline" onClick={handleAddItem}>
              + Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {quote.items.length === 0 ? (
            <p className="text-text-muted text-center py-4">
              No items yet. Add your first item above.
            </p>
          ) : (
            quote.items.map((item) => (
              <QuoteItem
                key={item.id}
                item={item}
                editable
                onUpdate={handleItemUpdate}
                onDelete={handleItemDelete}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={quote.notes || ""}
            onChange={(e) => handleFieldChange("notes", e.target.value)}
            placeholder="Additional notes or special instructions..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text-muted">GST Mode</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGstToggle}
              className="text-sm"
            >
              {gstInclusive ? "GST Inclusive" : "GST Exclusive"}
            </Button>
          </div>

          <Separator className="my-3" />

          <div className="space-y-2">
            <div className="flex justify-between text-text-muted">
              <span>Subtotal</span>
              <span>{formatNZD(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>GST (15%)</span>
              <span>{formatNZD(quote.gst)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-lg font-semibold text-text">
              <span>Total</span>
              <span>{formatNZD(quote.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        className="w-full bg-primary hover:bg-primary-dark text-white py-6 text-lg"
      >
        Save Quote
      </Button>
    </div>
  );
}
