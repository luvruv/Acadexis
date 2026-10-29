import { expect, test } from "@playwright/test";
import { login, readState, signOut } from "./helpers.mjs";

// One section travels through the whole review cycle, with three different
// people. The tests run in order and share the same database state.
test.describe.configure({ mode: "serial" });

test.describe("section workflow in the browser", () => {
  let state;
  test.beforeAll(() => {
    state = readState();
  });

  test("the coordinator assigns Course Description to teacher 1", async ({ page }) => {
    await login(page, "coordinator");
    await page.goto(`/coordinator/course-files/${state.courseFileId}`);
    await page.getByLabel("Assignee for section 3").selectOption(state.teacher1Id);
    await page.getByRole("button", { name: "Save assignments" }).click();
    await expect(page.locator('p[role="status"]')).toHaveText("Saved 1 change(s).");
  });

  test("teacher 1 sees it, cannot submit an empty form, then submits", async ({ page }) => {
    await login(page, "teacher1");
    await page.goto("/teacher");
    await expect(page.getByText("Course Description").first()).toBeVisible();

    await page.goto(`/sections/${state.descriptionSectionId}`);
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText("Course description is required.");

    await page.locator("#field-description").fill("Introduces end to end testing.");
    await page.locator("#field-objectives").fill("Learn to test whole flows.");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.locator('p[role="status"]')).toHaveText("Submitted for review.");
  });

  test("teacher 2 cannot open that section", async ({ page }) => {
    await login(page, "teacher2");
    const response = await page.goto(`/sections/${state.descriptionSectionId}`);
    expect(response.status()).toBe(404);
  });

  test("the coordinator must write a comment to request changes, then does", async ({ page }) => {
    await login(page, "coordinator");
    await page.goto(`/sections/${state.descriptionSectionId}`);

    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(
      "Write a comment (at least 5 characters) explaining what to change."
    );

    await page.locator("#review-comment").fill("Please add the week 7 topics.");
    await page.getByRole("button", { name: "Request changes" }).click();
      // The review panel disappears once the section is sent back.
    await expect(page.getByRole("button", { name: "Request changes" })).toHaveCount(0);
    await expect(page.getByText("Changes requested").first()).toBeVisible();
  });

  test("teacher 1 edits and resubmits", async ({ page }) => {
    await login(page, "teacher1");
    await page.goto(`/sections/${state.descriptionSectionId}`);
    await page.locator("#field-description").fill("Introduces end to end testing, with week 7.");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.locator('p[role="status"]')).toHaveText("Submitted for review.");
  });

  test("the coordinator approves, and the teacher can no longer edit", async ({ page }) => {
    await login(page, "coordinator");
    await page.goto(`/sections/${state.descriptionSectionId}`);
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.locator('p[role="status"]')).toHaveText("Section approved.");
    await signOut(page);

    await login(page, "teacher1");
    await page.goto(`/sections/${state.descriptionSectionId}`);
    await expect(page.getByRole("button", { name: "Submit for review" })).toHaveCount(0);
  });
});
