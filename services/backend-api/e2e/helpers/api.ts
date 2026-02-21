import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Page } from "@playwright/test";
import type { Feed, Connection } from "./types";
import { MOCK_RSS_FEED_URL } from "./constants";

export const E2E_PREFIX = "e2e-";
const CONFIG_FILE = join(process.cwd(), "e2econfig.json");

interface E2EConfig {
  channelId?: string;
  forumChannelId?: string;
  serverName?: string;
  channelName?: string;
  forumChannelName?: string;
  inviteUsername?: string;
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

export function getTestServerName(): string | undefined {
  return process.env.E2E_TEST_SERVER_NAME || loadConfig().serverName;
}

export function getTestChannelName(): string | undefined {
  return process.env.E2E_TEST_CHANNEL_NAME || loadConfig().channelName;
}

export function getTestForumChannelId(): string | undefined {
  return process.env.E2E_TEST_FORUM_CHANNEL_ID || loadConfig().forumChannelId;
}

export function getTestForumChannelName(): string | undefined {
  return (
    process.env.E2E_TEST_FORUM_CHANNEL_NAME || loadConfig().forumChannelName
  );
}

export function getTestInviteUsername(): string | undefined {
  return process.env.E2E_TEST_INVITE_USERNAME || loadConfig().inviteUsername;
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

export async function createConnectionWithOptions(
  page: Page,
  feedId: string,
  channelId: string,
  options?: {
    name?: string;
    threadCreationMethod?: "new-thread";
  },
): Promise<Connection> {
  const testId = generateTestId();
  const body: Record<string, unknown> = {
    name: options?.name ?? `Test Connection ${testId}`,
    channelId,
  };

  if (options?.threadCreationMethod) {
    body.threadCreationMethod = options.threadCreationMethod;
  }

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

export async function createWebhookConnection(
  page: Page,
  feedId: string,
  channelId: string,
  options: { name?: string; webhookName: string; webhookIconUrl?: string },
): Promise<Connection> {
  const testId = generateTestId();
  const body = {
    name: options.name ?? `Test Webhook Connection ${testId}`,
    applicationWebhook: {
      channelId,
      name: options.webhookName,
      iconUrl: options.webhookIconUrl,
    },
  };

  const response = await page.request.post(
    `/api/v1/user-feeds/${feedId}/connections/discord-channels`,
    { data: body },
  );

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(
      `Failed to create webhook connection: ${response.status()} - ${text}`,
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
  data: {
    disabledCode?: string;
    userRefreshRateSeconds?: number | null;
    passingComparisons?: string[];
    blockingComparisons?: string[];
    formatOptions?: {
      dateFormat?: string;
      dateTimezone?: string;
      dateLocale?: string;
    };
    dateCheckOptions?: {
      oldArticleDateDiffMsThreshold?: number;
    };
    externalProperties?: Array<{
      id: string;
      sourceField: string;
      label: string;
      cssSelector: string;
    }>;
  },
): Promise<void> {
  const response = await page.request.patch(`/api/v1/user-feeds/${feedId}`, {
    data,
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to update feed: ${response.status()} - ${text}`);
  }
}

export async function updateConnection(
  page: Page,
  feedId: string,
  connectionId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const response = await page.request.patch(
    `/api/v1/user-feeds/${feedId}/connections/discord-channels/${connectionId}`,
    { data },
  );

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(
      `Failed to update connection: ${response.status()} - ${text}`,
    );
  }
}

export interface ConnectionDetails {
  id: string;
  name: string;
  filters?: {
    expression?: Record<string, unknown>;
  };
  rateLimits?: Array<{ timeWindowSeconds: number; limit: number }>;
  customPlaceholders?: Array<{
    id: string;
    referenceName: string;
    sourcePlaceholder: string;
    steps: Array<{ id: string; type: string }>;
  }>;
  details: {
    content?: string;
    embeds?: Array<Record<string, unknown>>;
    webhook?: {
      id: string;
      channelId?: string;
      name?: string;
      iconUrl?: string;
      isApplicationOwned?: boolean;
    };
    channel?: {
      id: string;
    };
  };
}

export async function getConnection(
  page: Page,
  feedId: string,
  connectionId: string,
): Promise<ConnectionDetails> {
  const response = await page.request.get(`/api/v1/user-feeds/${feedId}`);

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to get feed: ${response.status()} - ${text}`);
  }

  const data = await response.json();
  const connections = data.result.discordChannelConnections || [];
  const connection = connections.find(
    (c: { id: string }) => c.id === connectionId,
  );

  if (!connection) {
    const availableIds = connections.map((c: { id: string }) => c.id);
    throw new Error(
      `Connection ${connectionId} not found in feed ${feedId}. Available: ${JSON.stringify(availableIds)}`,
    );
  }

  return connection;
}

export async function copyConnectionSettings(
  page: Page,
  feedId: string,
  connectionId: string,
  data: {
    properties: string[];
    targetDiscordChannelConnectionIds: string[];
  },
): Promise<void> {
  const response = await page.request.post(
    `/api/v1/user-feeds/${feedId}/connections/discord-channels/${connectionId}/copy-connection-settings`,
    { data },
  );

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(
      `Failed to copy connection settings: ${response.status()} - ${text}`,
    );
  }
}

export async function getAllUserFeeds(page: Page): Promise<Feed[]> {
  const response = await page.request.get(
    "/api/v1/user-feeds?limit=100&offset=0",
  );

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to get user feeds: ${response.status()} - ${text}`);
  }

  const data = await response.json();
  return (data.results || []).map(
    (f: { id: string; title: string; url: string }) => ({
      id: f.id,
      title: f.title,
      url: f.url,
    }),
  );
}

export async function deleteAllUserFeeds(page: Page): Promise<void> {
  const feeds = await getAllUserFeeds(page);
  for (const feed of feeds) {
    await deleteFeed(page, feed.id).catch(() => {});
  }
}
