import { describe, it, expect, beforeEach } from "vitest";
import { formatAuditAction, getAuditActionColour } from "../auditLog";

describe("auditLog utilities", () => {
  describe("formatAuditAction", () => {
    it("formats quote actions", () => {
      expect(formatAuditAction("quote.created")).toBe("Quote Created");
      expect(formatAuditAction("quote.updated")).toBe("Quote Updated");
      expect(formatAuditAction("quote.deleted")).toBe("Quote Deleted");
      expect(formatAuditAction("quote.sent")).toBe("Quote Sent");
      expect(formatAuditAction("quote.accepted")).toBe("Quote Accepted");
      expect(formatAuditAction("quote.duplicated")).toBe("Quote Duplicated");
      expect(formatAuditAction("quote.exported")).toBe("Quote Exported");
    });

    it("formats profile actions", () => {
      expect(formatAuditAction("profile.updated")).toBe("Profile Updated");
    });

    it("formats template actions", () => {
      expect(formatAuditAction("template.created")).toBe("Template Created");
      expect(formatAuditAction("template.deleted")).toBe("Template Deleted");
    });

    it("formats auth actions", () => {
      expect(formatAuditAction("auth.login")).toBe("User Login");
      expect(formatAuditAction("auth.logout")).toBe("User Logout");
      expect(formatAuditAction("auth.signup")).toBe("User Signup");
    });
  });

  describe("getAuditActionColour", () => {
    it("returns red for deleted actions", () => {
      const colour = getAuditActionColour("quote.deleted");
      expect(colour).toContain("red");
    });

    it("returns green for accepted actions", () => {
      const colour = getAuditActionColour("quote.accepted");
      expect(colour).toContain("green");
    });

    it("returns blue for sent actions", () => {
      const colour = getAuditActionColour("quote.sent");
      expect(colour).toContain("blue");
    });

    it("returns purple for auth actions", () => {
      expect(getAuditActionColour("auth.login")).toContain("purple");
      expect(getAuditActionColour("auth.logout")).toContain("purple");
      expect(getAuditActionColour("auth.signup")).toContain("purple");
    });

    it("returns neutral for other actions", () => {
      const colour = getAuditActionColour("quote.created");
      expect(colour).toContain("gray");
    });
  });
});
