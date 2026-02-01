"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { QuoteItem } from "./QuoteItem";
import { formatNZD } from "@/lib/utils/currency";
import { formatNZDate } from "@/lib/utils/date";
import type { Quote } from "@/types/quote";

interface QuotePreviewProps {
  quote: Quote;
  showHeader?: boolean;
}

export function QuotePreview({ quote, showHeader = true }: QuotePreviewProps) {
  const statusColors = {
    draft: "bg-amber-100 text-amber-800 border-amber-200",
    sent: "bg-blue-100 text-blue-800 border-blue-200",
    accepted: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <div className="flex flex-col gap-4" id="quote-preview">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">Quote</h1>
            <p className="text-text-muted text-sm">{formatNZDate(quote.createdAt)}</p>
          </div>
          <Badge className={statusColors[quote.status]} variant="outline">
            {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
          </Badge>
        </div>
      )}

      {/* Customer Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-text-muted">Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-semibold text-text text-lg">{quote.customerName}</p>
          {quote.customerPhone && (
            <p className="text-text-muted">
              <a href={`tel:${quote.customerPhone}`} className="hover:text-primary">
                {quote.customerPhone}
              </a>
            </p>
          )}
          {quote.customerEmail && (
            <p className="text-text-muted">
              <a href={`mailto:${quote.customerEmail}`} className="hover:text-primary">
                {quote.customerEmail}
              </a>
            </p>
          )}
          {quote.customerAddress && (
            <p className="text-text-muted mt-2 whitespace-pre-line">
              {quote.customerAddress}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-text-muted">Items</CardTitle>
        </CardHeader>
        <CardContent>
          {quote.items.map((item) => (
            <QuoteItem key={item.id} item={item} />
          ))}
        </CardContent>
      </Card>

      {/* Notes */}
      {quote.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-text-muted">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text whitespace-pre-line">{quote.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Totals */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-text-muted">
              <span>Subtotal</span>
              <span>{formatNZD(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>GST (15%){quote.gstInclusive ? " incl." : ""}</span>
              <span>{formatNZD(quote.gst)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-xl font-bold text-text">
              <span>Total</span>
              <span>{formatNZD(quote.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
