import { readFileSync } from "fs";
import { MongoClient } from "mongodb";
import { AUTH_STATE_PATH } from "./constants";

const MONGO_URI = "mongodb://127.0.0.1:27018/rss";
const BASE_URL = "http://localhost:3000";

function getCookieHeader(): string {
  const authData = JSON.parse(readFileSync(AUTH_STATE_PATH, "utf-8"));
  const cookies = authData.cookies || [];
  return cookies
    .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
    .join("; ");
}

async function getDiscordUserId(): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/v1/discord-users/@me`, {
    headers: { Cookie: getCookieHeader() },
  });
  const data = await response.json();
  return data.id;
}

export async function setCancellationDateInDb(
  discordUserId?: string,
): Promise<void> {
  const userId = discordUserId || (await getDiscordUserId());
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
        { _id: userId },
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
