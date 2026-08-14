import type { EventEmitter } from "node:events"

export const DEFAULT_RABBITMQ_DISCONNECT_GRACE_MS = 30_000

const CONSUMER_CONNECTION_ERROR_PREFIX =
  "RabbitMQ connection or channel error:"

export function isRabbitMqConsumerConnectionError(error: Error): boolean {
  return error.message.startsWith(CONSUMER_CONNECTION_ERROR_PREFIX)
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
