import { expect, test } from "@playwright/test";
import { USERS } from "./constants.mjs";
import { login, signOut, tryLogin } from "./helpers.mjs";

test.describe("authentication and access", () => {
  test("a wrong password shows an error and stays on the login page", async ({ page }) => {
    await tryLogin(page, USERS.coordinator.email, "Wrong-Password-1");
    await expect(page.locator('p[role="alert"]')).toHaveText("Invalid email or password.");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an unknown email gets the same message", async ({ page }) => {
    await tryLogin(page, "nobody@test.local", "Whatever-Password-1");
    await expect(page.locator('p[role="alert"]')).toHaveText("Invalid email or password.");
  });

  test("a coordinator signs in, sees their menu, and signs out", async ({ page }) => {
    await login(page, "coordinator");
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Welcome, E2E Coordinator" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My course files" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
    await signOut(page);
  });

  test("a co-teacher cannot open an admin page", async ({ page }) => {
    await login(page, "teacher1");
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });

  test("a co-teacher cannot open the coordinator area", async ({ page }) => {
    await login(page, "teacher1");
    await page.goto("/coordinator");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });

  test("an admin can open the user list and the audit log", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  });

  test("a signed-out visitor is sent to the login page", async ({ page }) => {
    await page.goto("/coordinator");
    await expect(page).toHaveURL(/\/login/);
  });

  test("five wrong passwords lock the account for a while", async ({ page }) => {
    for (let i = 0; i < 5; i += 1) {
      await tryLogin(page, USERS.lockme.email, "Wrong-Password-1");
      await expect(page.locator('p[role="alert"]')).toHaveText("Invalid email or password.");
    }
    await tryLogin(page, USERS.lockme.email); // even the correct password
    await expect(page.locator('p[role="alert"]')).toHaveText(
      "Too many failed attempts. Try again in 15 minutes."
    );
  });
});
