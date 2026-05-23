import { RESTProducer } from "@synzen/discord-rest"
import { createConsumerApp, type ConsumerAppHandle } from "../../src/app"
import { AmqpChannel } from "../../src/constants/amqpChannels"
import { setupTestEnvironment, type TestEnvironment } from "./setup-integration-tests"
import {
  startFakeDiscordServer,
  type FakeDiscordServer,
} from "./fake-discord-server"
import {
  connectRabbitMq,
  consumeMessages,
  waitFor,
  type RabbitMqHandle,
} from "./rabbitmq-helpers"

export interface ExitCall {
  code: number | undefined
}

export interface JobMetaInput {
  articleID?: string
  feedURL?: string
  channel?: string
  webhookId?: string
  feedId?: string
  guildId?: string
  emitDeliveryResult?: boolean
  [key: string]: unknown
}

export interface PublishJobOptions {
  /** Optional pathname appended to the fake Discord baseUrl. Defaults to `/api/v10/channels/test/messages`. */
  pathname?: string
  /** Optional override of the full route URL. Takes precedence over `pathname`. */
  route?: string
  body?: Record<string, unknown>
  meta?: JobMetaInput
  id?: string
}

export interface TestContext {
  env: TestEnvironment
  fakeDiscord: FakeDiscordServer
  app: ConsumerAppHandle
  exitCalls: ExitCall[]
  producer: RESTProducer
  /** Publishes a job through the real RESTProducer so the consumer picks it up. */
  publishJob: (options?: PublishJobOptions) => Promise<{ jobId: string; route: string }>
  /** Reads up to `count` messages from the FeedArticleDeliveryResult queue with a timeout. */
  awaitDeliveryResults: (count: number, timeoutMs?: number) => Promise<unknown[]>
  /**
   * Poll the delivery result queue for a message matching `jobId`.
   * Non-matching messages are nack'd back to the queue so parallel tests don't lose them.
   */
  awaitDeliveryResultForJob: (jobId: string, timeoutMs?: number) => Promise<unknown | null>
  /** Wait for the predicate to become true. Useful for waiting on DB writes triggered by async event handlers. */
  waitFor: typeof waitFor
  cleanup: () => Promise<void>
}

export interface CreateTestContextOptions {
  /**
   * When true, append a route to the fake Discord server by default.
   * Set false if a test wants to publish to an arbitrary external host (it won't actually call out).
   */
  routeToFakeDiscord?: boolean
  configOverrides?: Partial<import("../../src/schemas/ConfigSchema").ConfigType>
}

export async function createTestContext(
  options: CreateTestContextOptions = {}
): Promise<TestContext> {
  const env = setupTestEnvironment()
  const exitCalls: ExitCall[] = []

  let fakeDiscord: FakeDiscordServer | undefined
  let app: ConsumerAppHandle | undefined
  let producer: RESTProducer | undefined
  let rabbit: RabbitMqHandle | undefined

  const partialCleanup = async () => {
    if (rabbit) await rabbit.close().catch(() => {})
    if (producer) await producer.close().catch(() => {})
    if (app) await app.close().catch(() => {})
    if (fakeDiscord) await fakeDiscord.stop().catch(() => {})
    await env.drop().catch(() => {})
  }

  try {
    fakeDiscord = await startFakeDiscordServer()

    app = await createConsumerApp({
      exit: (code) => {
        exitCalls.push({ code })
      },
      config: { ...env.config, ...options.configOverrides },
    })

    producer = new RESTProducer(env.config.rabbitmqUri, {
      clientId: env.config.discordClientId,
    })
    await producer.initialize()

    rabbit = await connectRabbitMq(env.config.rabbitmqUri)
    await rabbit.channel.assertQueue(AmqpChannel.FeedArticleDeliveryResult, {
      durable: true,
    })
  } catch (err) {
    await partialCleanup()
    throw err
  }

  // Past the try block, all resources are guaranteed to be set.
  const readyFakeDiscord = fakeDiscord!
  const readyApp = app!
  const readyProducer = producer!
  const readyRabbit = rabbit!

  const defaultPathname = "/api/v10/channels/test-channel/messages"
  const routeToFakeDiscord = options.routeToFakeDiscord ?? true

  return {
    env,
    fakeDiscord: readyFakeDiscord,
    app: readyApp,
    exitCalls,
    producer: readyProducer,

    async publishJob(opts: PublishJobOptions = {}) {
      const pathname = opts.pathname ?? defaultPathname
      const route = opts.route ?? (routeToFakeDiscord ? `${readyFakeDiscord.baseUrl}${pathname}` : pathname)
      const meta = {
        articleID: opts.meta?.articleID,
        feedURL: opts.meta?.feedURL ?? "https://example.com/feed.xml",
        feedId: opts.meta?.feedId,
        guildId: opts.meta?.guildId ?? "test-guild",
        channel: opts.meta?.channel,
        webhookId: opts.meta?.webhookId,
        emitDeliveryResult: opts.meta?.emitDeliveryResult,
        ...opts.meta,
      }

      const id = opts.id ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      await readyProducer.enqueue(
        route,
        {
          method: "POST",
          body: JSON.stringify(opts.body ?? { content: "hello" }),
        },
        { id, ...meta }
      )
      return { jobId: id, route }
    },

    awaitDeliveryResults(count, timeoutMs = 5000) {
      return consumeMessages(
        readyRabbit.channel,
        AmqpChannel.FeedArticleDeliveryResult,
        count,
        timeoutMs
      )
    },

    async awaitDeliveryResultForJob(jobId, timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const msg = await readyRabbit.channel.get(AmqpChannel.FeedArticleDeliveryResult, { noAck: false })
        if (msg === false) {
          await new Promise((r) => setTimeout(r, 200))
          continue
        }
        let parsed: { job?: { id?: string }; [k: string]: unknown }
        try {
          parsed = JSON.parse(msg.content.toString())
        } catch {
          readyRabbit.channel.ack(msg)
          continue
        }
        if (parsed.job?.id === jobId) {
          readyRabbit.channel.ack(msg)
          return parsed
        }
        readyRabbit.channel.nack(msg, false, true)
        await new Promise((r) => setTimeout(r, 50))
      }
      return null
    },

    waitFor,

    async cleanup() {
      await partialCleanup()
    },
  }
}
