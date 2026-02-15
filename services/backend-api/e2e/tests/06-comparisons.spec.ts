import { test, expect } from "../fixtures/test-fixtures";

test.describe("Comparisons Tab", () => {
  test("shows empty state when no passing or blocking comparisons", async ({
    page,
    testFeed,
  }) => {
    await page.goto(`/feeds/${testFeed.id}?view=comparisons`);
    await expect(
      page.getByRole("heading", { name: "Blocking Comparison", exact: true }),
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText("You currently have no blocking comparisons created."),
    ).toBeVisible({ timeout: 10000 });
  });

  test("can add and remove a passing comparison", async ({
    page,
    testFeed,
  }) => {
    await page.goto(`/feeds/${testFeed.id}?view=comparisons`);
    await expect(
      page.getByRole("heading", { name: "Comparisons", exact: true }),
    ).toBeVisible({ timeout: 10000 });

    const passingSelect = page.getByLabel("Add a new passing comparison");
    await passingSelect.waitFor({ state: "visible", timeout: 10000 });

    const options = await passingSelect.locator("option").allTextContents();
    const validOption = options.find(
      (opt) => opt && opt !== "Select a property to add",
    );

    expect(validOption).toBeTruthy();

    await passingSelect.selectOption({ label: validOption! });

    const addButton = page
      .locator("label")
      .filter({ hasText: "Add a new passing comparison" })
      .locator("..")
      .getByRole("button", { name: "Add" });
    await addButton.click();

    await page.waitForTimeout(1000);

    const deleteButton = page.getByRole("button", {
      name: new RegExp(`Delete passing comparison ${validOption}`),
    });
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    await page.waitForTimeout(1000);

    await expect(deleteButton).not.toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText("You currently have no passing comparisons created."),
    ).toBeVisible({ timeout: 10000 });
  });

  test("can add and remove a blocking comparison", async ({
    page,
    testFeed,
  }) => {
    await page.goto(`/feeds/${testFeed.id}?view=comparisons`);
    await expect(
      page.getByRole("heading", { name: "Comparisons", exact: true }),
    ).toBeVisible({ timeout: 10000 });

    const blockingSelect = page.getByLabel("Add a new blocking comparison");
    await blockingSelect.waitFor({ state: "visible", timeout: 10000 });

    const options = await blockingSelect.locator("option").allTextContents();
    const validOption = options.find(
      (opt) => opt && opt !== "Select a property to add",
    );

    expect(validOption).toBeTruthy();

    await blockingSelect.selectOption({ label: validOption! });

    const addButton = page
      .locator("label")
      .filter({ hasText: "Add a new blocking comparison" })
      .locator("..")
      .getByRole("button", { name: "Add" });
    await addButton.click();

    await page.waitForTimeout(1000);

    const deleteButton = page.getByRole("button", {
      name: new RegExp(`Delete blocking comparison ${validOption}`),
    });
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    await page.waitForTimeout(1000);

    await expect(deleteButton).not.toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText("You currently have no blocking comparisons created."),
    ).toBeVisible({ timeout: 10000 });
  });

  test("can preview sample article properties", async ({ page, testFeed }) => {
    await page.goto(`/feeds/${testFeed.id}?view=comparisons`);
    await expect(
      page.getByRole("heading", { name: "Comparisons", exact: true }),
    ).toBeVisible({ timeout: 10000 });

    const selectArticleButton = page.getByRole("button", {
      name: "Select article to preview",
    });
    await expect(selectArticleButton).toBeVisible({ timeout: 10000 });
    await selectArticleButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const randomArticleButton = dialog.getByRole("button", {
      name: "Select random article",
    });
    await expect(randomArticleButton).toBeVisible({ timeout: 10000 });
    await randomArticleButton.click();

    await dialog.waitFor({ state: "hidden", timeout: 10000 });

    const previewSection = page.locator(
      'aside[aria-labelledby="preview-article-props"]',
    );
    const tableRows = previewSection.locator("table tbody tr");
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
  });
});
