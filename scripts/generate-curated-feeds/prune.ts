/**
 * Standalone sweep over the live curated_feeds collection: re-validates every
 * enabled feed and soft-disables the ones prod can no longer fetch, without
 * running the full regeneration pipeline. Same two-stage validation as the
 * pipeline's step 7.5: recent prod request history first, then a live probe
 * through the prod fetcher for anything without a healthy history.
 *
 * Usage:
 *   npm run prune            # report dead feeds, then confirm before disabling
 *   npm run prune -- --dry-run   # report only, write nothing
 */

import readline from "readline";
import type { AnyBulkWriteOperation } from "mongodb";
import { checkUrlsReliability, probeExistingFeeds } from "./disable-probe";
import { ProdFetchAbortError } from "./prod-fetch";
import { setUpProdFeedRequestsApi } from "./prod-fetch-tunnel";

const CONCURRENCY_LIMIT = 10;

interface CuratedFeed {
  url: string;
  title: string;
}

async function confirmDisable(count: number): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await new Promise<string>((resolve) =>
      rl.question(`\nDisable these ${count} feeds? (y/N) `, resolve),
    );
    return ["y", "yes"].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
  }
  if (!process.env.FEEDREQUESTS_POSTGRES_URI) {
    throw new Error("FEEDREQUESTS_POSTGRES_URI environment variable is required");
  }

  const dryRun = process.argv.includes("--dry-run");

  console.log("=== Curated Feeds Prune ===\n");
  if (dryRun) console.log("Dry run: nothing will be written\n");

  const session = await setUpProdFeedRequestsApi();

  const { MongoClient } = await import("mongodb");
  const mongoClient = new MongoClient(process.env.MONGODB_URI);
  await mongoClient.connect();

  try {
    const db = mongoClient.db();
    const feeds = (await db
      .collection("curated_feeds")
      .find({ disabled: { $ne: true } })
      .project({ url: 1, title: 1 })
      .toArray()) as unknown as CuratedFeed[];

    console.log(`Loaded ${feeds.length} enabled curated feeds\n`);
    if (feeds.length === 0) return;

    console.log("--- Stage 1: Prod request history ---");
    const urls = feeds.map((f) => f.url);
    const { Client } = await import("pg");
    const pgClient = new Client({
      connectionString: process.env.FEEDREQUESTS_POSTGRES_URI,
    });
    await pgClient.connect();
    const reliableUrls = await checkUrlsReliability(pgClient, urls);
    await pgClient.end();
    console.log(`${reliableUrls.size}/${urls.length} have a healthy recent history\n`);

    const needsProbe = feeds.filter((f) => !reliableUrls.has(f.url));
    let probeValid = new Set<string>();

    if (needsProbe.length > 0) {
      console.log("--- Stage 2: Live prod probe ---");
      console.log(`Probing ${needsProbe.length} feeds via prod...`);
      probeValid = await probeExistingFeeds(
        needsProbe.map((f) => f.url),
        CONCURRENCY_LIMIT,
      );
      console.log(`${probeValid.size}/${needsProbe.length} passed the probe\n`);
    }

    const deadFeeds = needsProbe.filter((f) => !probeValid.has(f.url));

    console.log("--- Result ---");
    if (deadFeeds.length === 0) {
      console.log("All curated feeds are healthy — nothing to disable");
      return;
    }

    console.log(`${deadFeeds.length} dead feeds:`);
    for (const feed of deadFeeds) {
      console.log(`  - ${feed.title} (${feed.url})`);
    }

    if (dryRun) {
      console.log("\nDry run — skipped disabling");
      return;
    }

    if (!(await confirmDisable(deadFeeds.length))) {
      console.log("Aborted — nothing was disabled");
      return;
    }

    const ops: AnyBulkWriteOperation[] = deadFeeds.map((feed) => ({
      updateOne: {
        filter: { url: feed.url },
        update: { $set: { disabled: true } },
        upsert: false,
      },
    }));
    const result = await db.collection("curated_feeds").bulkWrite(ops);
    console.log(`\nDisabled ${result.modifiedCount} feeds`);
  } finally {
    await mongoClient.close();
    session.stop();
  }
}

main().catch((err) => {
  if (err instanceof ProdFetchAbortError) {
    console.error(`Aborting run without disabling anything: ${err.message}`);
  } else {
    console.error("Fatal error:", err);
  }
  process.exit(1);
});
