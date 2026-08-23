import { expect, test, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

const TAG_COLORS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
] as const;

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: "Account settings" }),
  ).toBeVisible({
    timeout: 15000,
  });
}

async function createWorkspaceFeed(page: Page): Promise<string> {
  await page.goto("/feeds");
  await waitForAuthenticatedApp(page);
  const discordUserId = await getDiscordUserIdFromPage(page);
  await enableWorkspacesFeatureInDb(discordUserId);
  await setVerifiedEmailInDb(
    discordUserId,
    `verified-${discordUserId}@example.com`,
  );
  await page.reload();
  await waitForAuthenticatedApp(page);

  await page.getByRole("button", { name: /switch workspace/i }).click();
  await page.getByRole("menuitem", { name: /create a workspace/i }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog
    .getByLabel("Workspace name")
    .fill(`E2E Feed Tags ${Date.now()}`);
  await createDialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, {
    timeout: 15000,
  });
  const slug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
  expect(slug).toBeTruthy();

  const search = page.getByRole("textbox", {
    name: "Search popular feeds or paste a URL",
  });
  await search.fill(MOCK_RSS_FEED_URL);
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await page
    .getByRole("button", { name: /^Add .+ feed$/i })
    .first()
    .click();
  await page.getByRole("button", { name: /View your feeds/ }).click();
  await expect(page.getByRole("link", { name: /^Configure/ })).toBeVisible();

  return slug as string;
}

test("creates and assigns a Team tag while editing a feed and renders it in the table", async ({
  page,
}) => {
  const slug = await createWorkspaceFeed(page);

  await expect(
    page.locator("table th").filter({ hasText: "Tags" }),
  ).toBeVisible();
  await page.locator('button[aria-label^="Display table columns"]').click();
  await expect(
    page.getByRole("menuitemcheckbox", { name: "Tags" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: /^Configure/ }).click();
  await page.getByRole("button", { name: "Feed Actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();

  const editDialog = page.getByRole("dialog");
  for (const helperText of [
    "Used to help you identify the feed.",
    "Must be a link to a valid RSS XML feed.",
    "Tags help your Team organize related feeds. Add up to 10.",
  ]) {
    expect(
      await editDialog
        .getByText(helperText, { exact: true })
        .evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
    ).toBeGreaterThanOrEqual(14);
  }

  for (const inputName of ["Title", "RSS Feed Link", "Tags"]) {
    const input = editDialog.getByLabel(inputName);
    const dimensions = await input.evaluate((element) => {
      const styles = getComputedStyle(element);
      const control = element.closest('[class*="-control"]');

      return {
        fontSize: Number.parseFloat(styles.fontSize),
        controlHeight: control
          ? Number.parseFloat(getComputedStyle(control).height)
          : undefined,
        inputHeight: Number.parseFloat(styles.height),
      };
    });
    expect(dimensions.fontSize).toBeGreaterThanOrEqual(16);
    expect(
      dimensions.controlHeight ?? dimensions.inputHeight,
    ).toBeGreaterThanOrEqual(44);
  }

  for (const color of TAG_COLORS) {
    const name =
      color === "purple"
        ? "Launch"
        : `${color[0].toUpperCase()}${color.slice(1)}`;
    await editDialog.getByRole("button", { name: "New tag" }).click();
    await editDialog.getByLabel("Tag name").fill(name);
    const colorLabel =
      color === "gray"
        ? "Neutral"
        : `${color[0].toUpperCase()}${color.slice(1)}`;
    const colorRadio = editDialog.getByRole("radio", { name: colorLabel });
    if (color === "gray" || color === "red") {
      await page.keyboard.press("Tab");

      if (color === "red") {
        await page.keyboard.press("ArrowRight");
      }
    } else {
      await editDialog
        .getByRole("radiogroup", { name: "Tag color" })
        .getByText(colorLabel, { exact: true })
        .click();
    }
    await expect(colorRadio).toBeChecked();

    if (color === "gray") {
      await expect(colorRadio).toBeFocused();
      const focusStyle = await colorRadio
        .locator('xpath=ancestor::*[@data-part="item"][1]')
        .evaluate((element) => {
          const styles = getComputedStyle(element);

          return {
            outlineStyle: styles.outlineStyle,
            outlineWidth: Number.parseFloat(styles.outlineWidth),
          };
        });
      expect(focusStyle.outlineStyle).not.toBe("none");
      expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);
    }

    await editDialog.getByRole("button", { name: "Create and add" }).click();
    const newTagButton = editDialog.getByRole("button", { name: "New tag" });
    await expect(newTagButton).toBeVisible();
    await expect(newTagButton).toBeFocused();
  }

  await expect(editDialog.getByText("Launch", { exact: true })).toBeVisible();
  const selectedChipStyles = await editDialog
    .getByTestId("workspace-tag-selected-chip")
    .evaluateAll((chips) =>
      chips.map((chip) => {
        const styles = getComputedStyle(chip);

        return {
          background: styles.backgroundColor,
          fontSize: Number.parseFloat(styles.fontSize),
        };
      }),
    );
  expect(selectedChipStyles).toHaveLength(TAG_COLORS.length);
  expect(
    new Set(selectedChipStyles.map(({ background }) => background)).size,
  ).toBe(TAG_COLORS.length);
  for (const styles of selectedChipStyles) {
    expect(styles.fontSize).toBeGreaterThanOrEqual(14);
  }
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(editDialog).not.toBeVisible();

  await page.goto(`/workspaces/${slug}/feeds`);
  const feedRow = page.locator("table tbody tr").first();
  const showAllTags = feedRow.getByRole("button", { name: /Show all tags/ });
  await expect(showAllTags).toBeVisible({ timeout: 15000 });
  await showAllTags.click();
  const allTagsDialog = page.getByRole("dialog", { name: "All tags" });
  await expect(
    allTagsDialog.getByText("Launch", { exact: true }),
  ).toBeVisible();
  const renderedTagStyles = await allTagsDialog
    .getByTestId("workspace-tag-chip")
    .evaluateAll((chips) => {
      const luminance = (color: string) => {
        const channels =
          color
            .match(/[\d.]+/g)
            ?.slice(0, 3)
            .map(Number) ?? [];
        const linear = channels.map((value) => {
          const channel = value / 255;

          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        });

        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
      };
      const ratio = (foreground: string, background: string) => {
        const foregroundLuminance = luminance(foreground);
        const backgroundLuminance = luminance(background);
        const lighter = Math.max(foregroundLuminance, backgroundLuminance);
        const darker = Math.min(foregroundLuminance, backgroundLuminance);

        return (lighter + 0.05) / (darker + 0.05);
      };
      const findSurroundingBackground = (element: Element) => {
        let current = element.parentElement;

        while (current) {
          const background = getComputedStyle(current).backgroundColor;
          const channels = background.match(/[\d.]+/g)?.map(Number) ?? [];

          if (
            channels.length === 3 ||
            (channels.length === 4 && channels[3] > 0)
          ) {
            return background;
          }

          current = current.parentElement;
        }

        return "rgb(0, 0, 0)";
      };

      return chips.map((chip) => {
        const styles = getComputedStyle(chip);
        const surroundingBackground = findSurroundingBackground(chip);

        return {
          text: ratio(styles.color, styles.backgroundColor),
          border: ratio(styles.borderColor, styles.backgroundColor),
          surroundingBorder: ratio(styles.borderColor, surroundingBackground),
          backgroundLuminance: luminance(styles.backgroundColor),
          fontSize: Number.parseFloat(styles.fontSize),
        };
      });
    });

  expect(renderedTagStyles).toHaveLength(TAG_COLORS.length);
  for (const styles of renderedTagStyles) {
    expect(styles.text).toBeGreaterThanOrEqual(4.5);
    expect(styles.border).toBeGreaterThanOrEqual(3);
    expect(styles.surroundingBorder).toBeGreaterThanOrEqual(3);
    expect(styles.backgroundLuminance).toBeLessThan(0.12);
    expect(styles.fontSize).toBeGreaterThanOrEqual(14);
  }

  expect(
    await showAllTags.evaluate((button) =>
      Number.parseFloat(getComputedStyle(button).fontSize),
    ),
  ).toBeGreaterThanOrEqual(14);
});
