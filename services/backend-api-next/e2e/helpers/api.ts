import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Page } from "@playwright/test";
import type { Feed, Connection } from "./types";
import { MOCK_RSS_FEED_URL } from "./constants";

export const E2E_PREFIX = "e2e-";
const CONFIG_FILE = join(process.cwd(), "e2e", "config.json");

interface E2EConfig {
  channelId?: string;
}

function loadConfig(): E2EConfig {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export function getTestChannelId(): string | undefined {
  return process.env.E2E_TEST_CHANNEL_ID || loadConfig().channelId;
}

export function generateTestId(): string {
  return `${E2E_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createFeed(
  page: Page,
  overrides?: { url?: string; title?: string },
): Promise<Feed> {
  const testId = generateTestId();
  const body = {
    url: overrides?.url ?? MOCK_RSS_FEED_URL,
    title: overrides?.title ?? `Test Feed ${testId}`,
  };

  const response = await page.request.post("/api/v1/user-feeds", {
    data: body,
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to create feed: ${response.status()} - ${text}`);
  }

  const data = await response.json();
  return {
    id: data.result.id,
    title: data.result.title,
    url: data.result.url,
  };
}

export async function deleteFeed(page: Page, feedId: string): Promise<void> {
  const response = await page.request.delete(`/api/v1/user-feeds/${feedId}`);

  if (!response.ok() && response.status() !== 404) {
    const text = await response.text();
    throw new Error(`Failed to delete feed: ${response.status()} - ${text}`);
  }
}

export async function createConnection(
  page: Page,
  feedId: string,
  channelId: string,
  overrides?: { name?: string },
): Promise<Connection> {
  const testId = generateTestId();
  const body = {
    name: overrides?.name ?? `Test Connection ${testId}`,
    channelId,
  };

  const response = await page.request.post(
    `/api/v1/user-feeds/${feedId}/connections/discord-channels`,
    { data: body },
  );

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(
      `Failed to create connection: ${response.status()} - ${text}`,
    );
  }

  const data = await response.json();
  return {
    id: data.result.id,
    name: data.result.name,
    key: data.result.key,
  };
}

export async function deleteConnection(
  page: Page,
  feedId: string,
  connectionId: string,
): Promise<void> {
  const response = await page.request.delete(
    `/api/v1/user-feeds/${feedId}/connections/discord-channels/${connectionId}`,
  );

  if (!response.ok() && response.status() !== 404) {
    const text = await response.text();
    throw new Error(
      `Failed to delete connection: ${response.status()} - ${text}`,
    );
  }
}

export async function enableAllTableColumns(page: Page): Promise<void> {
  const response = await page.request.patch("/api/v1/users/@me", {
    data: {
      preferences: {
        feedListColumnVisibility: {
          computedStatus: true,
          url: true,
          createdAt: true,
          refreshRateSeconds: true,
          ownedByUser: true,
        },
        feedListSort: null,
      },
    },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(
      `Failed to enable all table columns: ${response.status()} - ${text}`,
    );
  }
}

export async function updateFeed(
  page: Page,
  feedId: string,
  data: { disabledCode?: string; userRefreshRateSeconds?: number | null },
): Promise<void> {
  const response = await page.request.patch(`/api/v1/user-feeds/${feedId}`, {
    data,
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to update feed: ${response.status()} - ${text}`);
  }
}
