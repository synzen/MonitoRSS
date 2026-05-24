import amqp, { Connection, Channel, ConsumeMessage } from "amqplib"

export interface RabbitMqHandle {
  connection: Connection
  channel: Channel
  close: () => Promise<void>
}

export async function connectRabbitMq(uri: string): Promise<RabbitMqHandle> {
  const connection = await amqp.connect(uri)
  const channel = await connection.createChannel()
  return {
    connection,
    channel,
    async close() {
      try {
        await channel.close()
      } catch {
        // already closing
      }
      try {
        await connection.close()
      } catch {
        // already closed
      }
    },
  }
}

/**
 * Wait until at least `count` messages arrive on `queueName`, or `timeoutMs` elapses.
 * Returns the parsed JSON payloads in the order they were received.
 *
 * Messages are auto-acked so the queue is drained as the test reads from it.
 */
export async function consumeMessages(
  channel: Channel,
  queueName: string,
  count: number,
  timeoutMs: number
): Promise<unknown[]> {
  const received: unknown[] = []
  let consumerTag: string | undefined
  let timer: NodeJS.Timeout | undefined

  await new Promise<void>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out after ${timeoutMs}ms waiting for ${count} message(s) on "${queueName}" (got ${received.length})`
        )
      )
    }, timeoutMs)

    channel
      .consume(
        queueName,
        (message: ConsumeMessage | null) => {
          if (!message) {
            return
          }
          try {
            received.push(JSON.parse(message.content.toString()))
          } catch (err) {
            received.push({ __parseError: (err as Error).message, raw: message.content.toString() })
          }
          channel.ack(message)
          if (received.length >= count) {
            resolve()
          }
        },
        { noAck: false }
      )
      .then((res) => {
        consumerTag = res.consumerTag
      })
      .catch(reject)
  }).finally(async () => {
    if (timer) {
      clearTimeout(timer)
    }
    if (consumerTag) {
      try {
        await channel.cancel(consumerTag)
      } catch {
        // ignore
      }
    }
  })

  return received
}

/**
 * Wait up to `timeoutMs` for `predicate` to return true.
 * Polls every `intervalMs`.
 */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  options: { timeoutMs?: number; intervalMs?: number; message?: string } = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 5000
  const intervalMs = options.intervalMs ?? 50
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) {
      return
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(options.message ?? `waitFor timed out after ${timeoutMs}ms`)
}
