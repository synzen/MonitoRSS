import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  createTestContext,
  type TestContext,
} from "../helpers/test-context"

describe("RabbitMQ health", () => {
  let context: TestContext

  before(async () => {
    context = await createTestContext()
    const pathname = "/api/v10/channels/health-test/messages"
    context.fakeDiscord.register(pathname, () => ({
      status: 200,
      body: { id: "health-test-message" },
    }))
    await context.publishJob({ pathname })
    await context.waitFor(
      () => context.fakeDiscord.getRequestsFor(pathname).length === 1
    )
  })

  after(async () => {
    await context.cleanup()
  })

  it("requests a failed process exit when the REST consumer loses its connection", () => {
    context.app.consumer.emit(
      "err",
      new Error(
        "RabbitMQ connection or channel error: socket closed. Restarting connection."
      )
    )

    assert.deepEqual(context.exitCalls, [{ code: 1 }])
  })
})
