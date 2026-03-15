import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ItemTemplate } from "@/types/quote";

const mockStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
}));

// Import after mocking
const { getTemplates, saveTemplate, deleteTemplate } = await import("../templates");

describe("templates storage", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  describe("getTemplates", () => {
    it("returns default templates on first use", async () => {
      const templates = await getTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some((t: ItemTemplate) => t.description === "General Labour")).toBe(true);
    });

    it("seeds defaults into storage on first call", async () => {
      await getTemplates();
      const stored = mockStore.get("ksq_item_templates") as ItemTemplate[];
      expect(stored).toBeDefined();
      expect(stored.length).toBeGreaterThan(0);
    });

    it("returns stored templates if they exist", async () => {
      const custom: ItemTemplate[] = [
        { id: "custom-1", description: "Custom Item", unitPrice: 99 },
      ];
      mockStore.set("ksq_item_templates", custom);

      const templates = await getTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].description).toBe("Custom Item");
    });
  });

  describe("saveTemplate", () => {
    it("adds a new template", async () => {
      mockStore.set("ksq_item_templates", []);

      const newTemplate: ItemTemplate = {
        id: "new-1",
        description: "Plumbing Labour",
        unitPrice: 95,
        category: "Labour",
      };

      await saveTemplate(newTemplate);
      const stored = mockStore.get("ksq_item_templates") as ItemTemplate[];
      expect(stored).toHaveLength(1);
      expect(stored[0].description).toBe("Plumbing Labour");
    });

    it("updates an existing template by id", async () => {
      mockStore.set("ksq_item_templates", [
        { id: "t1", description: "Old Name", unitPrice: 50 },
      ]);

      await saveTemplate({ id: "t1", description: "New Name", unitPrice: 75 });
      const stored = mockStore.get("ksq_item_templates") as ItemTemplate[];
      expect(stored).toHaveLength(1);
      expect(stored[0].description).toBe("New Name");
      expect(stored[0].unitPrice).toBe(75);
    });
  });

  describe("deleteTemplate", () => {
    it("removes a template by id", async () => {
      mockStore.set("ksq_item_templates", [
        { id: "t1", description: "Keep", unitPrice: 50 },
        { id: "t2", description: "Remove", unitPrice: 60 },
      ]);

      await deleteTemplate("t2");
      const stored = mockStore.get("ksq_item_templates") as ItemTemplate[];
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("t1");
    });

    it("does nothing if id not found", async () => {
      mockStore.set("ksq_item_templates", [
        { id: "t1", description: "Keep", unitPrice: 50 },
      ]);

      await deleteTemplate("nonexistent");
      const stored = mockStore.get("ksq_item_templates") as ItemTemplate[];
      expect(stored).toHaveLength(1);
    });
  });

  describe("default templates", () => {
    it("includes common NZ trade items", async () => {
      const templates = await getTemplates();
      const descriptions = templates.map((t: ItemTemplate) => t.description);
      expect(descriptions).toContain("General Labour");
      expect(descriptions).toContain("Call-out Fee");
      expect(descriptions).toContain("Travel / Mobilisation");
    });

    it("all have valid ids and prices >= 0", async () => {
      const templates = await getTemplates();
      for (const t of templates) {
        expect(t.id).toBeTruthy();
        expect(t.unitPrice).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
