import { describe, it, expect, beforeEach } from "vitest";
import { t, getLocale, setLocale, getAvailableLocales } from "../index";

describe("i18n", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getLocale", () => {
    it("returns en-NZ by default", () => {
      expect(getLocale()).toBe("en-NZ");
    });

    it("returns stored locale", () => {
      localStorage.setItem("ksq_locale", "mi-NZ");
      expect(getLocale()).toBe("mi-NZ");
    });
  });

  describe("setLocale", () => {
    it("persists locale to localStorage", () => {
      setLocale("mi-NZ");
      expect(localStorage.getItem("ksq_locale")).toBe("mi-NZ");
    });
  });

  describe("t (translate)", () => {
    it("returns English translation by default", () => {
      expect(t("common.save")).toBe("Save");
      expect(t("common.cancel")).toBe("Cancel");
      expect(t("common.delete")).toBe("Delete");
    });

    it("returns Maori translation when locale is mi-NZ", () => {
      expect(t("common.save", "mi-NZ")).toBe("Tiaki");
      expect(t("common.cancel", "mi-NZ")).toBe("Whakakore");
      expect(t("common.delete", "mi-NZ")).toBe("Mukua");
    });

    it("translates dashboard keys", () => {
      expect(t("dashboard.title", "en-NZ")).toBe("Create a Quote");
      expect(t("dashboard.title", "mi-NZ")).toBe("Waihanga Kupu Utu");
    });

    it("translates quote keys", () => {
      expect(t("quote.gstInclusive", "en-NZ")).toBe("GST Inclusive");
      expect(t("quote.gstInclusive", "mi-NZ")).toBe("Taake Kei roto");
    });

    it("translates voice keys", () => {
      expect(t("voice.recording", "en-NZ")).toBe("Recording...");
      expect(t("voice.recording", "mi-NZ")).toBe("E hopu ana...");
    });

    it("translates revenue keys", () => {
      expect(t("revenue.title", "en-NZ")).toBe("Revenue Dashboard");
      expect(t("revenue.title", "mi-NZ")).toBe("Papa Moni Whiwhi");
    });

    it("translates admin keys", () => {
      expect(t("admin.auditLog", "en-NZ")).toBe("Audit Log");
      expect(t("admin.auditLog", "mi-NZ")).toBe("Rataka Arotake");
    });

    it("uses stored locale if none specified", () => {
      setLocale("mi-NZ");
      expect(t("common.save")).toBe("Tiaki");
    });
  });

  describe("getAvailableLocales", () => {
    it("returns two locales", () => {
      const locales = getAvailableLocales();
      expect(locales).toHaveLength(2);
    });

    it("includes en-NZ and mi-NZ", () => {
      const locales = getAvailableLocales();
      const codes = locales.map((l) => l.code);
      expect(codes).toContain("en-NZ");
      expect(codes).toContain("mi-NZ");
    });

    it("has labels for each locale", () => {
      const locales = getAvailableLocales();
      const enNZ = locales.find((l) => l.code === "en-NZ");
      const miNZ = locales.find((l) => l.code === "mi-NZ");
      expect(enNZ?.label).toBe("English (NZ)");
      expect(miNZ?.label).toBe("Te Reo Maori");
    });
  });
});
