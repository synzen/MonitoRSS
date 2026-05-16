import { MongoClient } from "mongodb";

interface CandidateDoc {
  url: string;
  searchTerms?: string[];
}

interface CuratedFeedDoc {
  url: string;
  searchTerms?: string[];
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  const isDryRun = process.argv.includes("--dry-run");

  const client = new MongoClient(mongoUri);
  await client.connect();
  console.log("Connected to MongoDB");

  try {
    const db = client.db();
    const curatedCollection = db.collection<CuratedFeedDoc>("curated_feeds");
    const candidatesCollection = db.collection<CandidateDoc>(
      "curated_feed_candidates",
    );

    const feeds = await curatedCollection
      .find({}, { projection: { url: 1, searchTerms: 1 } })
      .toArray();

    console.log(`Found ${feeds.length} curated feeds`);

    let updated = 0;
    let skippedNoTerms = 0;
    let skippedNoCandidate = 0;

    for (const feed of feeds) {
      const candidate = await candidatesCollection.findOne(
        { url: feed.url },
        { projection: { searchTerms: 1 } },
      );

      if (!candidate) {
        skippedNoCandidate++;
        continue;
      }

      const candidateTerms = candidate.searchTerms || [];
      if (candidateTerms.length === 0) {
        skippedNoTerms++;
        continue;
      }

      const existingTerms = new Set(feed.searchTerms || []);
      const newTerms = candidateTerms.filter((t) => !existingTerms.has(t));

      if (newTerms.length === 0) {
        skippedNoTerms++;
        continue;
      }

      console.log(`  ${feed.url}\n    + ${newTerms.join(", ")}`);

      if (!isDryRun) {
        await curatedCollection.updateOne(
          { url: feed.url },
          { $addToSet: { searchTerms: { $each: candidateTerms } } },
        );
      }
      updated++;
    }

    console.log(
      `\n${isDryRun ? "[dry-run] Would update" : "Updated"} ${updated} feed(s)`,
    );
    console.log(`Skipped (no candidate match): ${skippedNoCandidate}`);
    console.log(`Skipped (no new terms): ${skippedNoTerms}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
