export interface PasswordCheck {
  valid: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  errors: string[];
  label: "Too weak" | "Weak" | "Okay" | "Good" | "Strong";
}

const MIN_LENGTH = 8;

export function validatePassword(password: string): PasswordCheck {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`At least ${MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) {
    errors.push("One lowercase letter");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("One uppercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("One number");
  }

  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const longEnough = password.length >= 12;

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  const passed = 4 - errors.length;
  if (passed <= 0) score = 0;
  else if (passed === 1) score = 1;
  else if (passed === 2) score = 2;
  else if (passed === 3) score = 3;
  else score = hasSymbol || longEnough ? 4 : 3;

  const labels = ["Too weak", "Weak", "Okay", "Good", "Strong"] as const;

  return {
    valid: errors.length === 0,
    score,
    errors,
    label: labels[score],
  };
}
