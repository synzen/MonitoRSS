import { EventEmitter } from "node:events"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  isRabbitMqConsumerConnectionError,
  initializeWithRabbitMqRetry,
  watchRabbitMqConnection,
  watchRabbitMqDisconnectRecovery,
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

describe("initializeWithRabbitMqRetry", () => {
  it("returns without retrying when the first attempt succeeds", async () => {
    let attempts = 0
    const retries: number[] = []

    await initializeWithRabbitMqRetry(async () => {
      attempts += 1
    }, {
      onRetry: (attempt) => retries.push(attempt),
    })

    assert.equal(attempts, 1)
    assert.deepEqual(retries, [])
  })

  it("retries failed attempts until one succeeds", async () => {
    let attempts = 0
    const retryErrors: string[] = []

    await initializeWithRabbitMqRetry(async () => {
      attempts += 1
      if (attempts < 3) {
        throw new Error(`connect ECONNREFUSED (attempt ${attempts})`)
      }
    }, {
      baseDelayMs: 1,
      maxDelayMs: 5,
      windowMs: 1_000,
      onRetry: (_attempt, error) => retryErrors.push(error.message),
    })

    assert.equal(attempts, 3)
    assert.equal(retryErrors.length, 2)
  })

  it("rethrows the last error once the retry window has elapsed", async () => {
    let attempts = 0

    await assert.rejects(
      initializeWithRabbitMqRetry(async () => {
        attempts += 1
        throw new Error("broker still down")
      }, {
        baseDelayMs: 1,
        maxDelayMs: 1,
        windowMs: 20,
      }),
      /broker still down/
    )

    assert.ok(attempts >= 2)
  })
})

describe("watchRabbitMqDisconnectRecovery", () => {
  const waitUntil = async (
    predicate: () => boolean,
    timeoutMs = 1_000
  ) => {
    const start = Date.now()
    while (!predicate()) {
      if (Date.now() - start > timeoutMs) {
        throw new Error("Timed out waiting for condition")
      }
      await wait(5)
    }
  }

  it("recovers after a disconnect", async () => {
    const connection = new EventEmitter()
    let recovered = 0
    let recoveryAttempts = 0

    const stop = watchRabbitMqDisconnectRecovery({
      connection,
      settleDelayMs: 5,
      retryWindowMs: 500,
      baseDelayMs: 1,
      maxDelayMs: 1,
      recover: async () => {
        recoveryAttempts += 1
      },
      onRecoverySuccess: () => {
        recovered += 1
      },
    })

    connection.emit("disconnect")
    await waitUntil(() => recovered === 1)

    assert.equal(recoveryAttempts, 1)
    stop()
  })

  it("retries recovery while the broker is still down", async () => {
    const connection = new EventEmitter()
    let recoveryAttempts = 0
    let failures: Error[] = []

    const stop = watchRabbitMqDisconnectRecovery({
      connection,
      settleDelayMs: 5,
      retryWindowMs: 30,
      baseDelayMs: 1,
      maxDelayMs: 1,
      recover: async () => {
        recoveryAttempts += 1
        throw new Error("broker still down")
      },
      onRecoveryFailure: (error) => failures.push(error),
    })

    connection.emit("disconnect")
    await waitUntil(() => failures.length === 1)

    assert.ok(recoveryAttempts >= 2)
    stop()
  })

  it("ignores disconnects while a recovery is already in flight", async () => {
    const connection = new EventEmitter()
    let recoveries = 0
    let releaseFirst: (() => void) | undefined
    const firstRecovery = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const stop = watchRabbitMqDisconnectRecovery({
      connection,
      settleDelayMs: 5,
      retryWindowMs: 500,
      baseDelayMs: 1,
      maxDelayMs: 1,
      recover: async () => {
        recoveries += 1
        if (recoveries === 1) {
          await firstRecovery
        }
      },
    })

    connection.emit("disconnect")
    await waitUntil(() => recoveries === 1)
    connection.emit("disconnect")
    connection.emit("disconnect")
    releaseFirst!()
    await wait(50)

    assert.equal(recoveries, 1)
    stop()
  })

  it("stops reacting after being stopped", async () => {
    const connection = new EventEmitter()
    let recoveries = 0

    const stop = watchRabbitMqDisconnectRecovery({
      connection,
      settleDelayMs: 5,
      retryWindowMs: 500,
      baseDelayMs: 1,
      maxDelayMs: 1,
      recover: async () => {
        recoveries += 1
      },
    })

    stop()
    connection.emit("disconnect")
    await wait(50)

    assert.equal(recoveries, 0)
  })
})
