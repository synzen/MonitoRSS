import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27018/rss";

async function main() {
  const discordUserId = process.argv[2];

  if (!discordUserId) {
    console.error("Usage: npx tsx scripts/set-supporter.ts <discord-user-id>");
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI, { directConnection: true });

  try {
    await client.connect();
    const expireAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    await client
      .db()
      .collection("supporters")
      .updateOne(
        { _id: discordUserId },
        { $set: { expireAt, guilds: [] } },
        { upsert: true },
      );

    console.log(
      `Set ${discordUserId} as supporter (expires ${expireAt.toISOString()})`,
    );
  } finally {
    await client.close();
  }
}

main();
