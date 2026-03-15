import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27018/rss";

async function main() {
  const discordUserId = process.argv[2];

  if (!discordUserId) {
    console.error(
      "Usage: npx tsx scripts/clear-supporter.ts <discord-user-id>",
    );
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI, { directConnection: true });

  try {
    await client.connect();
    const result = await client
      .db()
      .collection("supporters")
      .deleteOne({ _id: discordUserId });

    if (result.deletedCount > 0) {
      console.log(`Cleared supporter status for ${discordUserId}`);
    } else {
      console.log(`No supporter record found for ${discordUserId}`);
    }
  } finally {
    await client.close();
  }
}

main();
