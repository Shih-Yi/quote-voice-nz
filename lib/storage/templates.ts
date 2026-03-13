import { get, set } from "idb-keyval";
import type { ItemTemplate } from "@/types/quote";

const TEMPLATES_KEY = "ksq_item_templates";

// Default templates for common NZ trade items
const DEFAULT_TEMPLATES: ItemTemplate[] = [
  { id: "tpl-1", description: "General Labour", unitPrice: 85, category: "Labour" },
  { id: "tpl-2", description: "Apprentice Labour", unitPrice: 45, category: "Labour" },
  { id: "tpl-3", description: "Call-out Fee", unitPrice: 120, category: "Fees" },
  { id: "tpl-4", description: "Site Visit / Inspection", unitPrice: 75, category: "Fees" },
  { id: "tpl-5", description: "Materials (Misc.)", unitPrice: 0, category: "Materials" },
  { id: "tpl-6", description: "Travel / Mobilisation", unitPrice: 50, category: "Fees" },
  { id: "tpl-7", description: "Waste Disposal", unitPrice: 80, category: "Fees" },
  { id: "tpl-8", description: "Scaffolding Hire", unitPrice: 150, category: "Equipment" },
];

export async function getTemplates(): Promise<ItemTemplate[]> {
  const saved = await get<ItemTemplate[]>(TEMPLATES_KEY);
  if (!saved) {
    // Seed with defaults on first use
    await set(TEMPLATES_KEY, DEFAULT_TEMPLATES);
    return DEFAULT_TEMPLATES;
  }
  return saved;
}

export async function saveTemplate(template: ItemTemplate): Promise<void> {
  const templates = await getTemplates();
  const index = templates.findIndex((t) => t.id === template.id);
  if (index >= 0) {
    templates[index] = template;
  } else {
    templates.push(template);
  }
  await set(TEMPLATES_KEY, templates);
}

export async function deleteTemplate(id: string): Promise<void> {
  const templates = await getTemplates();
  await set(
    TEMPLATES_KEY,
    templates.filter((t) => t.id !== id)
  );
}
