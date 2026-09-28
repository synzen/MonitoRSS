import type { EventEmitter } from "node:events"

export const DEFAULT_RABBITMQ_DISCONNECT_GRACE_MS = 30_000
export const DEFAULT_RABBITMQ_INIT_RETRY_BASE_DELAY_MS = 1_000
export const DEFAULT_RABBITMQ_INIT_RETRY_MAX_DELAY_MS = 30_000
export const DEFAULT_RABBITMQ_INIT_RETRY_WINDOW_MS = 3 * 60_000

const CONSUMER_CONNECTION_ERROR_PREFIX =
  "RabbitMQ connection or channel error:"

export function isRabbitMqConsumerConnectionError(error: Error): boolean {
  return error.message.startsWith(CONSUMER_CONNECTION_ERROR_PREFIX)
}

export interface RabbitMqInitRetryOptions {
  baseDelayMs?: number
  maxDelayMs?: number
  windowMs?: number
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

/**
 * Retry an initialization step (e.g. RESTConsumer.initialize) that talks to
 * RabbitMQ directly and throws when the broker is still coming up. Backs off
 * exponentially until `windowMs` has elapsed, then rethrows the last error so
 * the process exits and the orchestrator's restart policy takes over.
 */
export async function initializeWithRabbitMqRetry(
  attempt: () => Promise<void>,
  options: RabbitMqInitRetryOptions = {},
): Promise<void> {
  const {
    baseDelayMs = DEFAULT_RABBITMQ_INIT_RETRY_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_RABBITMQ_INIT_RETRY_MAX_DELAY_MS,
    windowMs = DEFAULT_RABBITMQ_INIT_RETRY_WINDOW_MS,
    onRetry,
  } = options
  const start = Date.now()
  let attemptNumber = 0

  for (;;) {
    attemptNumber += 1

    try {
      await attempt()
      return
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const elapsed = Date.now() - start

      if (elapsed >= windowMs) {
        throw error
      }

      const delayMs = Math.min(
        baseDelayMs * 2 ** (attemptNumber - 1),
        maxDelayMs,
      )
      onRetry?.(attemptNumber, error, delayMs)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

export const DEFAULT_RABBITMQ_RECOVERY_SETTLE_DELAY_MS = 2_000
export const DEFAULT_RABBITMQ_RECOVERY_RETRY_WINDOW_MS = 20_000
export const DEFAULT_RABBITMQ_RECOVERY_BASE_DELAY_MS = 2_000
export const DEFAULT_RABBITMQ_RECOVERY_MAX_DELAY_MS = 5_000

export interface RabbitMqDisconnectRecoveryOptions {
  connection: Pick<EventEmitter, "on" | "removeListener">
  /**
   * Re-establish the RabbitMQ connection. Must be safe to call repeatedly,
   * including when the previous connection is half-open or already dead.
   */
  recover: () => Promise<void>
  settleDelayMs?: number
  retryWindowMs?: number
  baseDelayMs?: number
  maxDelayMs?: number
  onRecoverySuccess?: () => void
  onRecoveryFailure?: (error: Error) => void
}

/**
 * Recover the consumer when RabbitMQ connections are dropped (e.g. broker
 * restart). The lib's consumer only reconnects on connection 'error' events,
 * which graceful broker shutdowns never emit, so its raw connection can stay
 * dead silently while the reconnecting connection-manager masks the outage.
 * Recovery is attempted once per disconnect episode with retries inside
 * `retryWindowMs`; sustained outages stay the watchdog's job (it exits after
 * its grace period, which should exceed the recovery window).
 */
export function watchRabbitMqDisconnectRecovery(
  options: RabbitMqDisconnectRecoveryOptions,
): () => void {
  const {
    connection,
    recover,
    settleDelayMs = DEFAULT_RABBITMQ_RECOVERY_SETTLE_DELAY_MS,
    retryWindowMs = DEFAULT_RABBITMQ_RECOVERY_RETRY_WINDOW_MS,
    baseDelayMs = DEFAULT_RABBITMQ_RECOVERY_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_RABBITMQ_RECOVERY_MAX_DELAY_MS,
    onRecoverySuccess,
    onRecoveryFailure,
  } = options
  let recoveryInFlight = false
  let stopped = false

  const handleDisconnect = () => {
    if (recoveryInFlight || stopped) {
      return
    }

    recoveryInFlight = true

    void (async () => {
      try {
        // Give the broker a moment to settle (e.g. mid-restart) before the
        // first attempt.
        await new Promise((resolve) => setTimeout(resolve, settleDelayMs))

        await initializeWithRabbitMqRetry(recover, {
          baseDelayMs,
          maxDelayMs,
          windowMs: retryWindowMs,
        })

        if (!stopped) {
          onRecoverySuccess?.()
        }
      } catch (err) {
        if (!stopped) {
          onRecoveryFailure?.(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        recoveryInFlight = false
      }
    })()
  }

  connection.on("disconnect", handleDisconnect)

  return () => {
    stopped = true
    connection.removeListener("disconnect", handleDisconnect)
  }
}

interface WatchRabbitMqConnectionOptions {
  connection: Pick<EventEmitter, "on" | "removeListener">
  gracePeriodMs: number
  onUnavailable: (error?: Error) => void
}

export function watchRabbitMqConnection({
  connection,
  gracePeriodMs,
  onUnavailable,
}: WatchRabbitMqConnectionOptions): () => void {
  let failureTimeout: NodeJS.Timeout | undefined
  let lastError: Error | undefined
  let stopped = false
  let unavailableReported = false

  const clearFailureTimeout = () => {
    if (failureTimeout) {
      clearTimeout(failureTimeout)
      failureTimeout = undefined
    }
  }

  const handleConnect = () => {
    lastError = undefined
    clearFailureTimeout()
  }

  const handleDisconnect = ({ err }: { err?: Error } = {}) => {
    lastError = err ?? lastError
    if (stopped || unavailableReported || failureTimeout) {
      return
    }

    failureTimeout = setTimeout(() => {
      failureTimeout = undefined
      if (stopped || unavailableReported) {
        return
      }

      unavailableReported = true
      onUnavailable(lastError)
    }, gracePeriodMs)
    failureTimeout.unref()
  }

  connection.on("connect", handleConnect)
  connection.on("disconnect", handleDisconnect)
  connection.on("connectFailed", handleDisconnect)

  return () => {
    if (stopped) {
      return
    }

    stopped = true
    clearFailureTimeout()
    connection.removeListener("connect", handleConnect)
    connection.removeListener("disconnect", handleDisconnect)
    connection.removeListener("connectFailed", handleDisconnect)
  }
}
