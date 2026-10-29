import fs from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";
import { PASSWORD, USERS } from "./constants.mjs";

export function readState() {
  return JSON.parse(fs.readFileSync(path.join("tests", "e2e", ".run", "state.json"), "utf8"));
}

export async function tryLogin(page, email, password = PASSWORD) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function login(page, key) {
  await tryLogin(page, USERS[key].email);
  await expect(page).toHaveURL(/\/(dashboard|admin|coordinator|teacher)/);
}

export async function signOut(page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}
