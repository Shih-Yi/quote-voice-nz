import { describe, it, expect, vi, afterEach } from "vitest";
import { formatNZDate, formatNZDateTime, formatRelativeTime } from "../date";

describe("date utilities", () => {
  describe("formatNZDate", () => {
    it("formats a Date object to DD/MM/YYYY", () => {
      const date = new Date(2026, 1, 10); // Feb 10, 2026
      expect(formatNZDate(date)).toBe("10/02/2026");
    });

    it("formats an ISO string to DD/MM/YYYY", () => {
      expect(formatNZDate("2026-12-25")).toBe("25/12/2026");
    });

    it("handles single-digit days and months with zero padding", () => {
      expect(formatNZDate("2026-01-05")).toBe("05/01/2026");
    });
  });

  describe("formatNZDateTime", () => {
    it("formats with date and time", () => {
      const date = new Date(2026, 1, 10, 14, 30); // Feb 10, 2026 2:30 PM
      expect(formatNZDateTime(date)).toBe("10/02/2026 14:30");
    });

    it("formats an ISO string with time", () => {
      expect(formatNZDateTime("2026-06-15T09:05:00")).toBe("15/06/2026 09:05");
    });
  });

  describe("formatRelativeTime", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns 'Just now' for times less than 1 minute ago", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-10T12:00:30Z"));
      expect(formatRelativeTime("2026-02-10T12:00:00Z")).toBe("Just now");
    });

    it("returns minutes ago", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-10T12:05:00Z"));
      expect(formatRelativeTime("2026-02-10T12:00:00Z")).toBe("5m ago");
    });

    it("returns hours ago", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-10T15:00:00Z"));
      expect(formatRelativeTime("2026-02-10T12:00:00Z")).toBe("3h ago");
    });

    it("returns days ago for less than 7 days", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-13T12:00:00Z"));
      expect(formatRelativeTime("2026-02-10T12:00:00Z")).toBe("3d ago");
    });

    it("returns formatted date for 7+ days ago", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-20T12:00:00Z"));
      expect(formatRelativeTime("2026-02-10T12:00:00Z")).toBe("10/02/2026");
    });
  });
});
