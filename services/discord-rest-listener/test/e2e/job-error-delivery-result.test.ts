import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { ObjectId } from "@mikro-orm/mongodb"
import { createTestContext, type TestContext } from "../helpers/test-context"

interface DeliveryResultMessage {
  job: { id: string; meta?: Record<string, unknown> }
  result: { state: string; status?: number; message?: string }
}

describe("jobError delivery result publishing", () => {
  let ctx: TestContext

  before(async () => {
    ctx = await createTestContext({
      configOverrides: {
        rejectJobsAfterDurationMs: 2000,
      },
    })
  })

  after(async () => {
    await ctx.cleanup()
  })

  it("[CONTRACT] jobError with emitDeliveryResult=true publishes error result to delivery result queue", async () => {
    ctx.fakeDiscord.clear()
    const pathname = `/api/v10/channels/${idLike()}/messages`
    ctx.fakeDiscord.register(pathname, () => ({
      status: 0,
      hang: true,
    }))

    const feedId = newFeedId()
    const jobId = `job-err-${Date.now()}`
    await ctx.publishJob({
      pathname,
      id: jobId,
      meta: {
        articleID: `art-${Date.now()}`,
        feedId,
        feedURL: "https://example.com/rss",
        guildId: "g1",
        emitDeliveryResult: true,
      },
    })

    const resultMessage = (await ctx.awaitDeliveryResultForJob(jobId, 15000)) as DeliveryResultMessage | null
    assert.ok(resultMessage, "error delivery result was never published for job")
    assert.equal(resultMessage!.result.state, "error")
    assert.ok(
      resultMessage!.result.message && resultMessage!.result.message.length > 0,
      "error result should include an error message"
    )
    assert.equal(resultMessage!.job.id, jobId)
  })

  it("[CONTRACT] jobError with emitDeliveryResult=false does not publish to result queue", async () => {
    ctx.fakeDiscord.clear()
    const pathname = `/api/v10/channels/${idLike()}/messages`
    ctx.fakeDiscord.register(pathname, () => ({
      status: 0,
      hang: true,
    }))

    const jobId = `job-no-emit-${Date.now()}`
    await ctx.publishJob({
      pathname,
      id: jobId,
      meta: {
        articleID: `art-${Date.now()}`,
        feedId: newFeedId(),
        feedURL: "https://example.com/rss",
        guildId: "g1",
        emitDeliveryResult: false,
      },
    })

    const resultMessage = await ctx.awaitDeliveryResultForJob(jobId, 5000)
    assert.equal(
      resultMessage,
      null,
      "result queue should have no message for this job when emitDeliveryResult is false"
    )
  })
})

function newFeedId(): string {
  return new ObjectId().toHexString()
}

function idLike(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1e6)}`
}
