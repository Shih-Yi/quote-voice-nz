import { describe, it, expect, beforeEach, vi } from "vitest";

const mockSignInWithOtp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockGetUser = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("../client", () => ({
  getSupabase: () => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      signInWithPassword: mockSignInWithPassword,
      getUser: mockGetUser,
      updateUser: mockUpdateUser,
    },
  }),
}));

// Stub window.location.origin used inside signInWithMagicLink
Object.defineProperty(window, "location", {
  value: { origin: "https://test.ksq.nz" },
  writable: true,
});

import { signInWithMagicLink, changePassword } from "../auth";

describe("signInWithMagicLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls signInWithOtp with correct redirect and shouldCreateUser", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const result = await signInWithMagicLink("test@example.com");

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      options: {
        emailRedirectTo: "https://test.ksq.nz/auth/callback",
        shouldCreateUser: true,
      },
    });
    expect(result).toEqual({ error: null });
  });

  it("returns the Supabase error message on failure", async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: { message: "Rate limit exceeded" },
    });

    const result = await signInWithMagicLink("test@example.com");
    expect(result).toEqual({ error: "Rate limit exceeded" });
  });
});

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an error when no authenticated user is found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await changePassword("old-pass", "new-pass-123!");

    expect(result.error).toMatch(/signed in with an email/i);
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("returns 'Current password is incorrect' when re-authentication fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "user@example.com" } },
    });
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const result = await changePassword("wrong-pass", "new-pass-123!");

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "wrong-pass",
    });
    expect(result).toEqual({ error: "Current password is incorrect" });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("updates the password when current password is correct", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "user@example.com" } },
    });
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });

    const result = await changePassword("old-pass", "new-pass-123!");

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "new-pass-123!" });
    expect(result).toEqual({ error: null });
  });

  it("surfaces updateUser errors after successful verification", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "user@example.com" } },
    });
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({
      error: { message: "Password too weak" },
    });

    const result = await changePassword("old-pass", "new");
    expect(result).toEqual({ error: "Password too weak" });
  });
});
