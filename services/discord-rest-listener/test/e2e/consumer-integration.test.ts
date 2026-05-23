import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { ObjectId } from "@mikro-orm/mongodb"
import { createTestContext, type TestContext } from "../helpers/test-context"
import DeliveryRecord from "../../src/entities/DeliveryRecord"
import GeneralStat from "../../src/entities/GeneralStat"
import Feed from "../../src/entities/Feed"
import { BAD_FORMAT } from "../../src/constants/feedDisableReasons"

describe("consumer integration", () => {
  let ctx: TestContext

  before(async () => {
    ctx = await createTestContext()
  })

  after(async () => {
    await ctx.cleanup()
  })

  // ==========================================================================
  // CONTRACT — our business logic. Library-agnostic. These should ride through
  // the @synzen/discord-rest → discord.js migration untouched. A failure here
  // post-migration signals a real regression.
  // ==========================================================================

  it("[CONTRACT] happy path: 200 response with emitDeliveryResult writes DeliveryRecord, increments ARTICLES_SENT, publishes to result queue", async () => {
    ctx.fakeDiscord.clear()
    const pathname = `/api/v10/channels/${idLike()}/messages`
    ctx.fakeDiscord.register(pathname, () => ({
      status: 200,
      body: { id: "msg-id" },
    }))

    const feedId = newFeedId()
    const articleID = `art-${Date.now()}`
    const { jobId } = await ctx.publishJob({
      pathname,
      meta: {
        articleID,
        feedId,
        feedURL: "https://example.com/rss",
        guildId: "g1",
        emitDeliveryResult: true,
      },
    })

    await ctx.waitFor(
      async () => (await ctx.app.orm.em.count(DeliveryRecord, { deliveryId: jobId })) > 0,
      { message: "DeliveryRecord never written" }
    )

    const record = await ctx.app.orm.em.findOne(DeliveryRecord, { deliveryId: jobId })
    assert.ok(record, "DeliveryRecord exists")
    assert.equal(record!.delivered, true)
    assert.equal(record!.articleID, articleID)
    assert.equal(record!.feedId, feedId)
    assert.equal(record!.feedURL, "https://example.com/rss")

    const stat = await ctx.app.orm.em.findOne(GeneralStat, GeneralStat.keys.ARTICLES_SENT)
    assert.ok(stat, "ARTICLES_SENT stat exists")
    assert.ok((stat!.data as number) >= 1)

    const [resultMessage] = (await ctx.awaitDeliveryResults(1, 5000)) as Array<{
      job: { id: string }
      result: { status: number }
    }>
    assert.equal(resultMessage.job.id, jobId)
    assert.equal(resultMessage.result.status, 200)
  })

  it("[CONTRACT] emitDeliveryResult=false: writes DeliveryRecord but publishes nothing to result queue", async () => {
    ctx.fakeDiscord.clear()
    const pathname = `/api/v10/channels/${idLike()}/messages`
    ctx.fakeDiscord.register(pathname, () => ({ status: 200, body: { id: "msg" } }))

    const { jobId } = await ctx.publishJob({
      pathname,
      meta: {
        articleID: `art-${Date.now()}`,
        feedId: newFeedId(),
        feedURL: "https://example.com/rss",
        guildId: "g1",
        emitDeliveryResult: false,
      },
    })

    await ctx.waitFor(
      async () => (await ctx.app.orm.em.count(DeliveryRecord, { deliveryId: jobId })) > 0
    )

    await assert.rejects(
      ctx.awaitDeliveryResults(1, 750),
      /Timed out/,
      "result queue should remain empty"
    )
  })

  it("[CONTRACT] HTTP 400: writes failure DeliveryRecord AND disables the feed with BAD_FORMAT", async () => {
    ctx.fakeDiscord.clear()
    const pathname = `/api/v10/channels/${idLike()}/messages`
    ctx.fakeDiscord.register(pathname, () => ({
      status: 400,
      body: { code: 50035, message: "Invalid form body" },
    }))

    const feedId = newFeedId()
    await seedFeed(ctx, feedId)

    const { jobId } = await ctx.publishJob({
      pathname,
      meta: {
        articleID: `art-${Date.now()}`,
        feedId,
        feedURL: "https://example.com/rss",
        guildId: "g1",
      },
    })

    await ctx.waitFor(
      async () => (await ctx.app.orm.em.count(DeliveryRecord, { deliveryId: jobId, delivered: false })) > 0,
      { message: "failure DeliveryRecord never written" }
    )

    await ctx.waitFor(
      async () => {
        const feed = await ctx.app.orm.em.findOne(Feed, { _id: new ObjectId(feedId) })
        return feed?.disabled === BAD_FORMAT
      },
      { message: `Feed was not disabled with ${BAD_FORMAT}` }
    )

    // On status > 300 with articleID, app.ts:172-184 writes BOTH a success and
    // a failure record with the same deliveryId. Look up the failure one.
    const record = await ctx.app.orm.em.findOne(DeliveryRecord, {
      deliveryId: jobId,
      delivered: false,
    })
    assert.ok(record, "failure DeliveryRecord should exist")
    assert.match(record!.comment ?? "", /Bad status code \(400\)/)
  })

  it("[CONTRACT] missing articleID: hits Discord but writes no DeliveryRecord", async () => {
    ctx.fakeDiscord.clear()
    const pathname = `/api/v10/channels/${idLike()}/messages`
    ctx.fakeDiscord.register(pathname, () => ({ status: 200, body: { id: "msg" } }))

    const beforeCount = await ctx.app.orm.em.count(DeliveryRecord, {})
    const { jobId } = await ctx.publishJob({
      pathname,
      meta: {
        // no articleID
        feedId: newFeedId(),
        feedURL: "https://example.com/rss",
        guildId: "g1",
      },
    })

    await ctx.waitFor(
      () => ctx.fakeDiscord.getRequestsFor(pathname).length > 0,
      { message: "fake Discord never received a request" }
    )
    await sleep(300) // give the jobCompleted handler a moment in case it would write

    const afterCount = await ctx.app.orm.em.count(DeliveryRecord, {})
    assert.equal(afterCount, beforeCount, "no new DeliveryRecord should be written")
    const record = await ctx.app.orm.em.findOne(DeliveryRecord, { deliveryId: jobId })
    assert.equal(record, null)
  })

  it("[CONTRACT] duplicate deliveryId: skips processing — no HTTP call, no new DeliveryRecord", async () => {
    ctx.fakeDiscord.clear()
    const pathname = `/api/v10/channels/${idLike()}/messages`
    ctx.fakeDiscord.register(pathname, () => ({ status: 200, body: { id: "msg" } }))

    const duplicateId = `dup-${Date.now()}`
    const feedId = newFeedId()

    // Pre-seed a DeliveryRecord with the id so checkIsDuplicate returns true.
    await ctx.app.orm.em.insert(DeliveryRecord, {
      _id: new ObjectId(),
      articleID: "preexisting",
      feedURL: "https://example.com/rss",
      feedId,
      delivered: true,
      deliveryId: duplicateId,
      addedAt: new Date(),
    })

    await ctx.publishJob({
      pathname,
      id: duplicateId,
      meta: {
        articleID: "would-be-new",
        feedId,
        feedURL: "https://example.com/rss",
        guildId: "g1",
      },
    })

    await sleep(750)

    assert.equal(
      ctx.fakeDiscord.getRequestsFor(pathname).length,
      0,
      "duplicate job should not result in a Discord call"
    )
    const count = await ctx.app.orm.em.count(DeliveryRecord, { deliveryId: duplicateId })
    assert.equal(count, 1, "no second DeliveryRecord row should be written")
  })

  it("[CONTRACT] 401 unauthorized: writes failure DeliveryRecord, does not disable feed, does not exit", async () => {
    ctx.fakeDiscord.clear()
    const pathname = `/api/v10/channels/${idLike()}/messages`
    ctx.fakeDiscord.register(pathname, () => ({
      status: 401,
      body: { code: 0, message: "401: Unauthorized" },
    }))

    const feedId = newFeedId()
    await seedFeed(ctx, feedId)
    const exitsBefore = ctx.exitCalls.length

    const { jobId } = await ctx.publishJob({
      pathname,
      meta: {
        articleID: `art-${Date.now()}`,
        feedId,
        feedURL: "https://example.com/rss",
        guildId: "g1",
      },
    })

    await ctx.waitFor(
      async () => (await ctx.app.orm.em.count(DeliveryRecord, { deliveryId: jobId, delivered: false })) > 0
    )

    const feed = await ctx.app.orm.em.findOne(Feed, { _id: new ObjectId(feedId) })
    assert.equal(feed?.disabled, undefined, "401 must not disable the feed")
    assert.equal(ctx.exitCalls.length, exitsBefore, "401 must not call exit")
  })

  // ==========================================================================
  // LIBRARY — these encode @synzen/discord-rest-specific behavior. The wiring
  // (events, retry policy, header detection) may not survive the discord.js
  // migration unchanged. During migration, decide for each whether to
  // re-implement the underlying behavior or accept a difference (and update or
  // delete the test accordingly).
  // ==========================================================================

  it("[LIBRARY] 5xx triggers retries; eventual 200 records a successful delivery", async () => {
    // LIBRARY BEHAVIOR: synzen's APIRequest auto-retries 5xx (and 422) responses
    // via node-retry. discord.js also retries 5xx by default but with different
    // counts/backoff — exact retry counts will differ after migration.
    ctx.fakeDiscord.clear()
    const pathname = `/api/v10/channels/${idLike()}/messages`
    ctx.fakeDiscord.register(pathname, ({ callCount }) =>
      callCount === 1
        ? { status: 503, body: { error: "service unavailable" } }
        : { status: 200, body: { id: "msg" } }
    )

    const { jobId } = await ctx.publishJob({
      pathname,
      meta: {
        articleID: `art-${Date.now()}`,
        feedId: newFeedId(),
        feedURL: "https://example.com/rss",
        guildId: "g1",
      },
    })

    await ctx.waitFor(
      async () =>
        (await ctx.app.orm.em.count(DeliveryRecord, { deliveryId: jobId, delivered: true })) > 0,
      { timeoutMs: 15000, message: "successful DeliveryRecord never recorded after retry" }
    )

    const requests = ctx.fakeDiscord.getRequestsFor(pathname)
    assert.ok(
      requests.length >= 2,
      `expected at least 2 attempts after retry, got ${requests.length}`
    )
  })

  // NOTE: this test must run LAST. The Cloudflare 429 handler in synzen's
  // RESTHandler globally blocks the queue for 3 hours, which would cause every
  // subsequent test to hang waiting for the bucket to unblock.
  it("[LIBRARY] Cloudflare 429 (x-ratelimit-global + no retry-after) calls exit(0)", async () => {
    // LIBRARY BEHAVIOR: synzen's Bucket treats 429 with x-ratelimit-global header
    // but no parseable retry-after as a Cloudflare ban, emits 'cloudflareRateLimit',
    // which RESTConsumer surfaces as a 'globalBlock' event and our handler maps to
    // exit(0). discord.js's REST module has no equivalent event — Cloudflare
    // detection would have to be re-implemented on the new path.
    ctx.fakeDiscord.clear()
    const exitsBefore = ctx.exitCalls.length
    const pathname = `/api/v10/channels/${idLike()}/messages`
    ctx.fakeDiscord.register(pathname, () => ({
      status: 429,
      headers: { "x-ratelimit-global": "true" },
      body: { message: "You are being rate limited." },
    }))

    await ctx.publishJob({
      pathname,
      meta: {
        articleID: `art-${Date.now()}`,
        feedId: newFeedId(),
        feedURL: "https://example.com/rss",
        guildId: "g1",
      },
    })

    await ctx.waitFor(
      () => ctx.exitCalls.length > exitsBefore,
      { timeoutMs: 8000, message: "exit was never called after Cloudflare 429" }
    )
    assert.equal(ctx.exitCalls[ctx.exitCalls.length - 1].code, 0)
  })
})

// ============================================================================
// helpers
// ============================================================================

function newFeedId(): string {
  return new ObjectId().toHexString()
}

function idLike(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1e6)}`
}

async function seedFeed(ctx: TestContext, feedId: string): Promise<void> {
  await ctx.app.orm.em.insert(Feed, {
    _id: new ObjectId(feedId),
  } as never)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
