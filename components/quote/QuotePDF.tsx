"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatNZD } from "@/lib/utils/currency";
import { formatNZDate } from "@/lib/utils/date";
import type { Quote } from "@/types/quote";

interface QuotePDFProps {
  quote: Quote;
}

export function QuotePDF({ quote }: QuotePDFProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = useCallback(async () => {
    setIsGenerating(true);

    try {
      const jsPDF = (await import("jspdf")).default;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Colours
      const primaryColor: [number, number, number] = [99, 102, 241]; // #6366F1
      const textColor: [number, number, number] = [17, 24, 39]; // #111827
      const mutedColor: [number, number, number] = [107, 114, 128]; // #6B7280

      // ============================================
      // HEADER with KQ Logo
      // ============================================
      // Logo background
      pdf.setFillColor(...primaryColor);
      pdf.roundedRect(margin, y, 15, 15, 2, 2, "F");

      // Logo text "KQ"
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("KQ", margin + 7.5, y + 9.5, { align: "center" });

      // Company name
      pdf.setTextColor(...textColor);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("KiwiSpeakQuote", margin + 20, y + 6);

      pdf.setTextColor(...mutedColor);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Quote", margin + 20, y + 12);

      // "QUOTE" title on right
      pdf.setTextColor(...primaryColor);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("QUOTE", pageWidth - margin, y + 10, { align: "right" });

      y += 25;

      // Date
      pdf.setTextColor(...mutedColor);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Date: ${formatNZDate(quote.createdAt)}`, margin, y);
      pdf.text(`Ref: ${quote.slug || quote.id.slice(0, 8)}`, pageWidth - margin, y, { align: "right" });

      y += 15;

      // ============================================
      // CUSTOMER DETAILS
      // ============================================
      pdf.setFillColor(249, 250, 251); // Light gray background
      pdf.roundedRect(margin, y, contentWidth, 35, 2, 2, "F");

      pdf.setTextColor(...mutedColor);
      pdf.setFontSize(9);
      pdf.text("QUOTE FOR", margin + 5, y + 8);

      pdf.setTextColor(...textColor);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(quote.customerName, margin + 5, y + 16);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      let customerY = y + 22;

      if (quote.customerAddress) {
        pdf.setTextColor(...mutedColor);
        const addressLines = pdf.splitTextToSize(quote.customerAddress, contentWidth - 10);
        pdf.text(addressLines, margin + 5, customerY);
        customerY += addressLines.length * 4;
      }

      if (quote.customerPhone) {
        pdf.text(quote.customerPhone, margin + 5, customerY);
        customerY += 4;
      }

      if (quote.customerEmail) {
        pdf.text(quote.customerEmail, margin + 5, customerY);
      }

      y += 45;

      // ============================================
      // ITEMS TABLE
      // ============================================
      // Table header
      pdf.setFillColor(...primaryColor);
      pdf.rect(margin, y, contentWidth, 10, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");

      const colDescription = margin + 5;
      const colQty = margin + 95;
      const colUnitPrice = margin + 115;
      const colTotal = margin + 145;

      pdf.text("Description", colDescription, y + 7);
      pdf.text("Qty", colQty, y + 7);
      pdf.text("Unit Price", colUnitPrice, y + 7);
      pdf.text("Total", colTotal, y + 7);

      y += 10;

      // Table rows
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textColor);

      quote.items.forEach((item, index) => {
        const rowY = y + index * 12;

        // Alternating row background
        if (index % 2 === 0) {
          pdf.setFillColor(249, 250, 251);
          pdf.rect(margin, rowY, contentWidth, 12, "F");
        }

        // Description (with text wrapping)
        const descLines = pdf.splitTextToSize(item.description, 85);
        pdf.text(descLines[0], colDescription, rowY + 8);

        // Qty
        pdf.text(item.quantity.toString(), colQty, rowY + 8);

        // Unit Price
        pdf.text(formatNZD(item.unitPrice), colUnitPrice, rowY + 8);

        // Total
        pdf.setFont("helvetica", "bold");
        pdf.text(formatNZD(item.total), colTotal, rowY + 8);
        pdf.setFont("helvetica", "normal");
      });

      y += quote.items.length * 12 + 5;

      // ============================================
      // NOTES (if any)
      // ============================================
      if (quote.notes) {
        y += 5;
        pdf.setTextColor(...mutedColor);
        pdf.setFontSize(9);
        pdf.text("NOTES", margin, y);
        y += 5;

        pdf.setTextColor(...textColor);
        pdf.setFontSize(10);
        const notesLines = pdf.splitTextToSize(quote.notes, contentWidth);
        pdf.text(notesLines, margin, y);
        y += notesLines.length * 5 + 5;
      }

      // ============================================
      // TOTALS
      // ============================================
      y += 10;

      const totalsX = pageWidth - margin - 60;

      // Subtotal
      pdf.setTextColor(...mutedColor);
      pdf.setFontSize(10);
      pdf.text("Subtotal", totalsX, y);
      pdf.setTextColor(...textColor);
      pdf.text(formatNZD(quote.subtotal), pageWidth - margin, y, { align: "right" });

      y += 7;

      // GST
      pdf.setTextColor(...mutedColor);
      pdf.text(`GST (15%)${quote.gstInclusive ? " incl." : ""}`, totalsX, y);
      pdf.setTextColor(...textColor);
      pdf.text(formatNZD(quote.gst), pageWidth - margin, y, { align: "right" });

      y += 3;

      // Divider line
      pdf.setDrawColor(229, 231, 235);
      pdf.line(totalsX - 10, y, pageWidth - margin, y);

      y += 8;

      // Total
      pdf.setTextColor(...textColor);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Total NZD", totalsX, y);
      pdf.setTextColor(...primaryColor);
      pdf.setFontSize(16);
      pdf.text(formatNZD(quote.total), pageWidth - margin, y, { align: "right" });

      // ============================================
      // FOOTER
      // ============================================
      const footerY = pdf.internal.pageSize.getHeight() - 15;

      pdf.setTextColor(...mutedColor);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text("Generated with KiwiSpeakQuote", pageWidth / 2, footerY, { align: "center" });
      pdf.text("All prices in NZD. GST rate: 15%", pageWidth / 2, footerY + 4, { align: "center" });

      // Save PDF
      pdf.save(`quote-${quote.slug || quote.id.slice(0, 8)}.pdf`);
      toast.success("PDF downloaded!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  }, [quote]);

  return (
    <Button
      variant="outline"
      onClick={generatePDF}
      disabled={isGenerating}
      className="gap-2"
    >
      {isGenerating ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
        </>
      )}
    </Button>
  );
}
