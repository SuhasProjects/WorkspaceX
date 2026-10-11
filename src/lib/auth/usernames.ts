import { HttpError } from "./http";

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const RESERVED = new Set(["admin", "administrator", "root", "support", "help", "api", "system", "workspacezero", "owner", "member", "null", "undefined", "me", "login", "logout", "register", "billing", "pricing"]);

/** Returns the display form and the lowercase lookup form, or throws INVALID_INPUT. */
export function checkedUsername(input: unknown): { username: string; usernameNormalized: string } {
  const username = typeof input === "string" ? input.trim() : "";
  if (!USERNAME_PATTERN.test(username)) {
    throw new HttpError(400, "INVALID_INPUT", "Usernames are 3 to 32 letters, digits, underscores, or hyphens.");
  }
  const usernameNormalized = username.toLowerCase();
  if (RESERVED.has(usernameNormalized)) throw new HttpError(400, "INVALID_INPUT", "That username is reserved.");
  return { username, usernameNormalized };
}

/** Passwords are not trimmed; whitespace is part of the secret. */
export function checkedPassword(input: unknown): string {
  if (typeof input !== "string" || input.length < 12 || input.length > 128) {
    throw new HttpError(400, "INVALID_INPUT", "Passwords are 12 to 128 characters.");
  }
  return input;
}

export const BCRYPT_COST = 12;
