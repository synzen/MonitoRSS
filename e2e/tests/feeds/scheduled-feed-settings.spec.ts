import { test, expect } from "../../fixtures/test-fixtures";

test.describe("Scheduled feed delivery settings", () => {
  test("switches a feed to scheduled mode, saves times and timezone, and renders them through the UI", async ({
    page,
    testFeed,
  }) => {
    await page.goto(`/feeds/${testFeed.id}?view=settings`);
    await expect(
      page.getByRole("heading", { name: testFeed.title }),
    ).toBeVisible({ timeout: 10000 });

    // Preserve a known interval value before switching modes so we can verify
    // it survives the round trip through scheduled mode.
    const refreshRateInput = page.locator('input[name="userRefreshRateMinutes"]');
    await refreshRateInput.clear();
    await refreshRateInput.fill("15");

    await page.getByText("At scheduled times", { exact: true }).click();

    // Scheduled mode hides the minutes input and shows the schedule editor.
    await expect(refreshRateInput).toBeHidden();
    const firstTimeInput = page.getByRole("textbox", { name: "Scheduled time 1" });
    await expect(firstTimeInput).toBeVisible({ timeout: 10000 });
    await firstTimeInput.fill("09:00");

    await page.getByRole("button", { name: "Add time" }).click();
    await page.getByRole("textbox", { name: "Scheduled time 2" }).fill("21:00");

    const timezoneSelect = page.getByRole("combobox", { name: "Schedule timezone" });
    await timezoneSelect.selectOption("Asia/Shanghai");

    // The resolved UTC offset, the computed next fetch and both expectation
    // notes render.
    await expect(page.getByText("GMT+8", { exact: true })).toBeVisible();
    await expect(page.getByTestId("next-scheduled-fetch")).toContainText(
      "Next fetch:",
    );
    await expect(
      page.getByText(
        "Articles are delivered once each. Something stuck at the top of the feed won't be sent again.",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "Save all changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible({
      timeout: 10000,
    });

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Scheduled time 1" })).toHaveValue("09:00", {
      timeout: 10000,
    });
    await expect(page.getByRole("textbox", { name: "Scheduled time 2" })).toHaveValue("21:00");
    await expect(timezoneSelect).toHaveValue("Asia/Shanghai");
    await expect(page.getByText("GMT+8", { exact: true })).toBeVisible();
    await expect(page.getByTestId("next-scheduled-fetch")).toContainText(
      "Next fetch:",
    );

    // The feed overview renders the schedule under the "Delivery Schedule"
    // label instead of an interval.
    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByText("09:00, 21:00 (Asia/Shanghai)"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("restricts a schedule to specific days of the week", async ({
    page,
    testFeed,
  }) => {
    await page.goto(`/feeds/${testFeed.id}?view=settings`);
    await expect(
      page.getByRole("heading", { name: testFeed.title }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByText("At scheduled times", { exact: true }).click();
    const firstTimeInput = page.getByRole("textbox", { name: "Scheduled time 1" });
    await expect(firstTimeInput).toBeVisible({ timeout: 10000 });
    await firstTimeInput.fill("09:00");

    await page.getByRole("combobox", { name: "Schedule timezone" }).selectOption(
      "Asia/Shanghai",
    );

    // All days start selected (an existing daily schedule); narrow to Mon/Fri.
    await expect(page.getByRole("checkbox", { name: "Mon", exact: true })).toBeChecked();
    for (const day of ["Sun", "Tue", "Wed", "Thu", "Sat"]) {
      // Chakra's styled control overlays the hidden input, so force the click
      // (the repo-wide pattern for Chakra checkboxes).
      await page.getByRole("checkbox", { name: day, exact: true }).uncheck({ force: true });
    }

    await page.getByRole("button", { name: "Save all changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible({
      timeout: 10000,
    });

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Scheduled time 1" })).toHaveValue(
      "09:00",
      { timeout: 10000 },
    );
    await expect(page.getByRole("checkbox", { name: "Mon", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Fri", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Sun", exact: true })).not.toBeChecked();

    // The feed overview renders the selected days under the "Delivery
    // Schedule" label.
    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByText("Mon, Fri at 09:00 (Asia/Shanghai)"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("switching back to refresh rate keeps the previous interval value", async ({
    page,
    testFeed,
  }) => {
    await page.goto(`/feeds/${testFeed.id}?view=settings`);
    await expect(
      page.getByRole("heading", { name: testFeed.title }),
    ).toBeVisible({ timeout: 10000 });

    const refreshRateInput = page.locator('input[name="userRefreshRateMinutes"]');
    await refreshRateInput.clear();
    await refreshRateInput.fill("15");

    // Persist the interval value while in interval mode; it must survive the
    // round trip through scheduled mode.
    await page.getByRole("button", { name: "Save all changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible({
      timeout: 10000,
    });

    await page.getByText("At scheduled times", { exact: true }).click();
    await expect(refreshRateInput).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Scheduled time 1" })).toBeVisible();
    await page.getByRole("textbox", { name: "Scheduled time 1" }).fill("09:00");

    await page.getByRole("button", { name: "Save all changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible({
      timeout: 10000,
    });

    // Switch back to interval mode and save.
    await page.getByText("Check automatically", { exact: true }).click();
    await expect(refreshRateInput).toBeVisible();
    await expect(refreshRateInput).toHaveValue("15");

    await page.getByRole("button", { name: "Save all changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible({
      timeout: 10000,
    });

    await page.reload();
    await expect(refreshRateInput).toHaveValue("15", { timeout: 10000 });

    await page.goto(`/feeds/${testFeed.id}`);
    await expect(page.getByText(/15 minutes/i)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("09:00 (Asia/Shanghai)"),
    ).toHaveCount(0);
  });
});
