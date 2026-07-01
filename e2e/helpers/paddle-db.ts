import { MongoClient } from "mongodb";
import type { Page } from "@playwright/test";
import { MONGO_URI } from "./constants";

export async function getDiscordUserIdFromPage(page: Page): Promise<string> {
  const response = await page.request.get("/api/v1/discord-users/@me");
  const data = (await response.json()) as { id: string };
  return data.id;
}

export async function setSupporterStatusInDb(
  discordUserId: string,
): Promise<void> {
  const expireAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const client = new MongoClient(MONGO_URI, { directConnection: true });

  try {
    await client.connect();
    await client
      .db()
      .collection("supporters")
      .updateOne(
        { _id: discordUserId as unknown as import("mongodb").ObjectId },
        { $set: { expireAt, guilds: [] } },
        { upsert: true },
      );
  } finally {
    await client.close();
  }
}

export async function clearSupporterStatusInDb(
  discordUserId: string,
): Promise<void> {
  const client = new MongoClient(MONGO_URI, { directConnection: true });

  try {
    await client.connect();
    await client
      .db()
      .collection("supporters")
      .deleteOne({
        _id: discordUserId as unknown as import("mongodb").ObjectId,
      });
  } finally {
    await client.close();
  }
}

/**
 * Cap the signed-in user's PERSONAL feed limit by seeding a supporter override
 * (`supporters.maxUserFeeds`), the same field the benefits resolver reads for a
 * manual supporter. Used to reproduce the workspace feed-discovery limit bug:
 * a workspace scope must gate on the WORKSPACE limit, not this personal one, so
 * setting the personal cap below the workspace's limit surfaces the regression
 * where the discovery cards read "Limit reached" despite workspace headroom.
 */
export async function setPersonalFeedLimitInDb(
  discordUserId: string,
  maxUserFeeds: number,
): Promise<void> {
  const expireAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const client = new MongoClient(MONGO_URI, { directConnection: true });

  try {
    await client.connect();
    await client
      .db()
      .collection("supporters")
      .updateOne(
        { _id: discordUserId as unknown as import("mongodb").ObjectId },
        { $set: { expireAt, guilds: [], maxUserFeeds } },
        { upsert: true },
      );
  } finally {
    await client.close();
  }
}

export async function setCancellationDateInDb(
  discordUserId: string,
): Promise<void> {
  const cancellationDate = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const client = new MongoClient(MONGO_URI, { directConnection: true });

  try {
    await client.connect();
    await client
      .db()
      .collection("supporters")
      .updateOne(
        { _id: discordUserId as unknown as import("mongodb").ObjectId },
        {
          $set: {
            "paddleCustomer.subscription.cancellationDate": cancellationDate,
          },
        },
      );
  } finally {
    await client.close();
  }
}
