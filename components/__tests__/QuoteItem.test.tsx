import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuoteItem } from "../quote/QuoteItem";
import type { LineItem } from "@/types/quote";

const mockItem: LineItem = {
  id: "item-1",
  description: "General labour",
  quantity: 2,
  unitPrice: 85,
  total: 170,
};

describe("QuoteItem", () => {
  describe("read-only mode", () => {
    it("renders item description", () => {
      render(<QuoteItem item={mockItem} />);
      expect(screen.getByText("General labour")).toBeInTheDocument();
    });

    it("renders quantity and unit price", () => {
      render(<QuoteItem item={mockItem} />);
      // Matches "2 × $85.00" pattern
      expect(screen.getByText(/2 ×/)).toBeInTheDocument();
    });

    it("renders total", () => {
      render(<QuoteItem item={mockItem} />);
      // $170.00 should appear
      expect(screen.getByText("$170.00")).toBeInTheDocument();
    });
  });

  describe("editable mode", () => {
    it("renders input fields when editable", () => {
      render(<QuoteItem item={mockItem} editable />);
      const inputs = screen.getAllByRole("spinbutton");
      // quantity and unit price inputs
      expect(inputs.length).toBeGreaterThanOrEqual(2);
    });

    it("renders description input", () => {
      render(<QuoteItem item={mockItem} editable />);
      const input = screen.getByPlaceholderText("Description");
      expect(input).toHaveValue("General labour");
    });

    it("calls onDelete when delete button is clicked", () => {
      const onDelete = vi.fn();
      render(<QuoteItem item={mockItem} editable onDelete={onDelete} />);
      const deleteBtn = screen.getByRole("button");
      fireEvent.click(deleteBtn);
      expect(onDelete).toHaveBeenCalledWith("item-1");
    });

    it("calls onUpdate when description changes", () => {
      const onUpdate = vi.fn();
      render(<QuoteItem item={mockItem} editable onUpdate={onUpdate} />);
      const input = screen.getByPlaceholderText("Description");
      fireEvent.change(input, { target: { value: "Plumbing labour" } });
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Plumbing labour" })
      );
    });

    it("recalculates total when quantity changes", () => {
      const onUpdate = vi.fn();
      render(<QuoteItem item={mockItem} editable onUpdate={onUpdate} />);
      const qtyInput = screen.getByPlaceholderText("Qty");
      fireEvent.change(qtyInput, { target: { value: "3" } });
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 3,
          total: 255, // 3 × 85
        })
      );
    });

    it("recalculates total when unit price changes", () => {
      const onUpdate = vi.fn();
      render(<QuoteItem item={mockItem} editable onUpdate={onUpdate} />);
      const priceInput = screen.getByPlaceholderText("Price");
      fireEvent.change(priceInput, { target: { value: "100" } });
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          unitPrice: 100,
          total: 200, // 2 × 100
        })
      );
    });
  });
});
