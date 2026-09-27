import { test, expect } from "../../fixtures/test-fixtures";

// Delivery schedule editing lives in the "Edit delivery schedule" dialog,
// opened from the Feed Overview's Delivery Schedule / Refresh Rate row.
const openDeliveryScheduleDialog = async (
  page: import("@playwright/test").Page,
) => {
  await page.getByRole("button", { name: /Delivery Schedule|Refresh Rate/ }).click();
  await expect(
    page.getByRole("heading", { name: "Edit delivery schedule" }),
  ).toBeVisible({ timeout: 10000 });
};

test.describe("Scheduled feed delivery settings", () => {
  test("switches a feed to scheduled mode, saves times and timezone, and renders them through the UI", async ({
    page,
    testFeed,
  }) => {
    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("heading", { name: "Feed Overview" }),
    ).toBeVisible({ timeout: 10000 });

    await openDeliveryScheduleDialog(page);

    await page.getByText("At scheduled times", { exact: true }).click();

    // Scheduled mode hides the minutes input and shows the schedule editor.
    const refreshRateInput = page.locator('input[name="userRefreshRateMinutes"]');
    await expect(refreshRateInput).toBeHidden();
    const firstTimeInput = page.getByRole("textbox", { name: "Scheduled time 1" });
    await expect(firstTimeInput).toBeVisible({ timeout: 10000 });
    await firstTimeInput.fill("09:00");

    await page.getByRole("button", { name: "Add time" }).click();
    await page.getByRole("textbox", { name: "Scheduled time 2" }).fill("21:00");

    const timezoneSelect = page.getByRole("combobox", { name: "Schedule timezone" });
    await timezoneSelect.selectOption("Asia/Shanghai");

    await page.getByRole("button", { name: "Save" }).click();

    // The dialog closes and the overview renders the schedule under the
    // "Delivery Schedule" label instead of an interval.
    await expect(refreshRateInput).toBeHidden();
    await expect(
      page.getByText("09:00, 21:00 (Asia/Shanghai)"),
    ).toBeVisible({ timeout: 10000 });

    // Reopen the dialog and verify the schedule persisted.
    await openDeliveryScheduleDialog(page);
    await expect(page.getByRole("textbox", { name: "Scheduled time 1" })).toHaveValue(
      "09:00",
      { timeout: 10000 },
    );
    await expect(page.getByRole("textbox", { name: "Scheduled time 2" })).toHaveValue(
      "21:00",
    );
    await expect(timezoneSelect).toHaveValue("Asia/Shanghai");
  });

  test("restricts a schedule to specific days of the week", async ({
    page,
    testFeed,
  }) => {
    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("heading", { name: "Feed Overview" }),
    ).toBeVisible({ timeout: 10000 });

    await openDeliveryScheduleDialog(page);

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

    await page.getByRole("button", { name: "Save" }).click();

    // The overview renders the selected days under the "Delivery Schedule"
    // label.
    await expect(
      page.getByText("Mon, Fri at 09:00 (Asia/Shanghai)"),
    ).toBeVisible({ timeout: 10000 });

    // Reopen the dialog and verify the day selection persisted.
    await openDeliveryScheduleDialog(page);
    await expect(page.getByRole("textbox", { name: "Scheduled time 1" })).toHaveValue(
      "09:00",
      { timeout: 10000 },
    );
    await expect(page.getByRole("checkbox", { name: "Mon", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Fri", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Sun", exact: true })).not.toBeChecked();
  });

  test("switching back to refresh rate keeps the previous interval value", async ({
    page,
    testFeed,
  }) => {
    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("heading", { name: "Feed Overview" }),
    ).toBeVisible({ timeout: 10000 });

    // Persist a known interval value while in interval mode; it must survive
    // the round trip through scheduled mode.
    await openDeliveryScheduleDialog(page);
    const refreshRateInput = page.locator('input[name="userRefreshRateMinutes"]');
    await refreshRateInput.fill("30");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(refreshRateInput).toBeHidden();
    await expect(page.getByText(/30 minutes/i)).toBeVisible({ timeout: 10000 });

    // Switch to scheduled mode and save.
    await openDeliveryScheduleDialog(page);
    await page.getByText("At scheduled times", { exact: true }).click();
    await expect(refreshRateInput).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Scheduled time 1" })).toBeVisible();
    await page.getByRole("textbox", { name: "Scheduled time 1" }).fill("09:00");
    await page
      .getByRole("combobox", { name: "Schedule timezone" })
      .selectOption("Asia/Shanghai");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("09:00 (Asia/Shanghai)")).toBeVisible({
      timeout: 10000,
    });

    // Switch back to interval mode: the previous interval value must be kept.
    await openDeliveryScheduleDialog(page);
    await page.getByText("Check automatically", { exact: true }).click();
    await expect(refreshRateInput).toBeVisible();
    await expect(refreshRateInput).toHaveValue("30");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(refreshRateInput).toBeHidden();

    await expect(page.getByText(/30 minutes/i)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("09:00 (Asia/Shanghai)"),
    ).toHaveCount(0);
  });
});
