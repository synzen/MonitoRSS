import { EventEmitter } from "node:events"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  isRabbitMqConsumerConnectionError,
  watchRabbitMqConnection,
} from "../../src/utils/rabbitmq-health"

const wait = (durationMs: number) =>
  new Promise((resolve) => setTimeout(resolve, durationMs))

describe("RabbitMQ health", () => {
  it("reports a persistent connection-manager outage", async () => {
    const connection = new EventEmitter()
    const failures: Array<Error | undefined> = []
    const stop = watchRabbitMqConnection({
      connection,
      gracePeriodMs: 10,
      onUnavailable: (error) => failures.push(error),
    })
    const error = new Error("broker unavailable")

    connection.emit("disconnect", { err: error })
    await wait(25)

    assert.deepEqual(failures, [error])
    stop()
  })

  it("cancels the pending failure when RabbitMQ reconnects", async () => {
    const connection = new EventEmitter()
    const failures: Array<Error | undefined> = []
    const stop = watchRabbitMqConnection({
      connection,
      gracePeriodMs: 20,
      onUnavailable: (error) => failures.push(error),
    })

    connection.emit("disconnect", { err: new Error("transient outage") })
    connection.emit("connect")
    await wait(35)

    assert.deepEqual(failures, [])
    stop()
  })

  it("removes its listeners and pending failure when stopped", async () => {
    const connection = new EventEmitter()
    const failures: Array<Error | undefined> = []
    const stop = watchRabbitMqConnection({
      connection,
      gracePeriodMs: 10,
      onUnavailable: (error) => failures.push(error),
    })

    connection.emit("disconnect", { err: new Error("broker unavailable") })
    stop()
    await wait(25)
    connection.emit("disconnect", { err: new Error("ignored") })
    await wait(25)

    assert.deepEqual(failures, [])
  })

  it("distinguishes consumer connection failures from job errors", () => {
    assert.equal(
      isRabbitMqConsumerConnectionError(
        new Error("RabbitMQ connection or channel error: socket closed. Restarting connection.")
      ),
      true
    )
    assert.equal(
      isRabbitMqConsumerConnectionError(new Error("Message validation failed")),
      false
    )
  })
})
