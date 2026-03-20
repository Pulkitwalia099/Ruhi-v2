import { generateId } from "ai";
import { getUnixTime } from "date-fns";

// -----------------------------------------------
// tests/helpers.ts
//
// export function generateRandomTestUser()    L11
// export function generateTestMessage()       L21
// -----------------------------------------------

export function generateRandomTestUser() {
  const email = `test-${getUnixTime(new Date())}@playwright.com`;
  const password = generateId();

  return {
    email,
    password,
  };
}

export function generateTestMessage() {
  return `Test message ${Date.now()}`;
}
