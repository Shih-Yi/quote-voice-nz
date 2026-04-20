import { describe, it, expect, beforeEach } from "vitest";
import {
  setRememberMe,
  markSessionActive,
  clearRememberMe,
  shouldExpireOnBoot,
} from "../sessionPersistence";

describe("sessionPersistence", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("setRememberMe", () => {
    it("stores 'true' when remember is true", () => {
      setRememberMe(true);
      expect(localStorage.getItem("ksq-remember-me")).toBe("true");
      expect(sessionStorage.getItem("ksq-session-active")).toBe("1");
    });

    it("stores 'false' when remember is false", () => {
      setRememberMe(false);
      expect(localStorage.getItem("ksq-remember-me")).toBe("false");
      expect(sessionStorage.getItem("ksq-session-active")).toBe("1");
    });
  });

  describe("markSessionActive", () => {
    it("sets the session-active marker", () => {
      markSessionActive();
      expect(sessionStorage.getItem("ksq-session-active")).toBe("1");
    });
  });

  describe("clearRememberMe", () => {
    it("removes both storage entries", () => {
      setRememberMe(true);
      clearRememberMe();
      expect(localStorage.getItem("ksq-remember-me")).toBeNull();
      expect(sessionStorage.getItem("ksq-session-active")).toBeNull();
    });
  });

  describe("shouldExpireOnBoot", () => {
    it("returns false when Remember Me was never set", () => {
      expect(shouldExpireOnBoot()).toBe(false);
    });

    it("returns false when Remember Me is true (persisted)", () => {
      localStorage.setItem("ksq-remember-me", "true");
      // Even with no active session marker, persisted mode must NOT force logout.
      expect(shouldExpireOnBoot()).toBe(false);
    });

    it("returns false when session-only and tab is still active", () => {
      localStorage.setItem("ksq-remember-me", "false");
      sessionStorage.setItem("ksq-session-active", "1");
      expect(shouldExpireOnBoot()).toBe(false);
    });

    it("returns true when session-only and browser has restarted", () => {
      // Simulate browser restart: localStorage survives, sessionStorage is gone.
      localStorage.setItem("ksq-remember-me", "false");
      // sessionStorage already cleared in beforeEach.
      expect(shouldExpireOnBoot()).toBe(true);
    });
  });

  describe("end-to-end flow", () => {
    it("Remember Me = true survives a simulated restart", () => {
      setRememberMe(true);
      sessionStorage.clear(); // Simulate browser restart.
      expect(shouldExpireOnBoot()).toBe(false);
    });

    it("Remember Me = false expires on a simulated restart", () => {
      setRememberMe(false);
      sessionStorage.clear(); // Simulate browser restart.
      expect(shouldExpireOnBoot()).toBe(true);
    });

    it("markSessionActive keeps the same tab alive across reloads", () => {
      setRememberMe(false);
      // Same tab navigates / reloads: sessionStorage survives.
      markSessionActive();
      expect(shouldExpireOnBoot()).toBe(false);
    });
  });
});
