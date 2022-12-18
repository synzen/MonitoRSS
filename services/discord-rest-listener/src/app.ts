import 'source-map-support/register'
import log, { logDatadog } from './utils/log'
import setup from './utils/setup'
import { MikroORM } from '@mikro-orm/core'
import { GLOBAL_BLOCK_TYPE, RequestTimeoutError, RESTConsumer, RESTProducer } from '@synzen/discord-rest'
import config from './utils/config'
import DeliveryRecord from './entities/DeliveryRecord'
import GeneralStat from './entities/GeneralStat'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { disableFeed, sendAlert } from './send-failure-notification'
import { BAD_FORMAT } from './constants/feedDisableReasons'
import { AmqpChannel } from './constants/amqpChannels'

dayjs.extend(utc)

interface ArticleMeta {
  articleID: string
  feedURL: string
  channel: string
  feedId: string
  guildId: string
}

interface JobMeta {
  id: string
  duration: number
  feedId: string
}

const recordArticleSuccess = async (orm: MikroORM, jobMeta: JobMeta, articleMeta: ArticleMeta) => {
  try {
    const record = new DeliveryRecord({
      ...articleMeta,
      deliveryId: jobMeta.id,
      executionTimeSeconds: jobMeta.duration,
      feedId: jobMeta.feedId
    }, true)
    await orm.em.nativeInsert(record)
    await GeneralStat.increaseNumericStat(orm, GeneralStat.keys.ARTICLES_SENT)
  } catch (err) {
    const errMessage = `Failed to record article success (${(err as Error).message})`
    log.error(errMessage)
    logDatadog('error', errMessage, {
      stack: (err as Error).stack
    })
  }
}

const recordArticleFailure = async (orm: MikroORM, jobMeta: JobMeta, articleMeta: ArticleMeta, errorMessage: string) => {
  try {
    const record = new DeliveryRecord({
      ...articleMeta,
      deliveryId: jobMeta.id,
      executionTimeSeconds: jobMeta.duration,
      feedId: jobMeta.feedId
    }, false)
    record.comment = errorMessage
    await orm.em.nativeInsert(record)
  } catch (err) {
    const errMessage = `Failed to record article failure (${(err as Error).message})`
    log.error(errMessage)
    logDatadog('error', errMessage, {
      stack: (err as Error).stack
    })
  }
}

setup().then(async (initializedData) => {
  const { orm, amqpChannelWrapper } = initializedData
  const producer = new RESTProducer(config.rabbitmqUri, {
    clientId: config.discordClientId
  })
  const consumer = new RESTConsumer(config.rabbitmqUri, {
    authHeader: `Bot ${config.token}`,
    clientId: config.discordClientId,
    rejectJobsAfterDurationMs: 1000 * 60 * 20,
    checkIsDuplicate: async (deliveryId) => {
      const count = await orm.em.count(DeliveryRecord, {
        deliveryId,
      })

      return count > 0
    }
  }, {
    maxRequestsPerSecond: config.maxRequestsPerSecond || 25,
    invalidRequestsThreshold: 5000,
  })

  try {
    consumer.on('err', (err) => {
      const errorMessage = `Consumer error: ${err.message}`
      log.error(errorMessage)
      logDatadog('error', errorMessage, {
        stack: err.stack
      })
    })

    consumer.on('next', (queueSize, pending) => {
      logDatadog('info', `Job completed, moving to next (queueSize: ${queueSize}, pending: ${pending})`, {
        queueSize,
        pending
      })
    })

    consumer.on('LongRunningBucketRequest', details => {
      const message = `Long running bucket request detected`
      log.warn(message, details)
      logDatadog('warn', message, details)
    })

    consumer.on('LongRunningHandlerRequest', details => {
      const message = `Long running handler request detected`
      log.warn(message, details)
      logDatadog('warn', message, details)
    })

    consumer.on('idle', () => {
      log.info('Consumer is idle')
      logDatadog('info', 'Consumer is idle')
    })

    consumer.on('active', () => {
      log.info('Consumer is active')
      logDatadog('info', 'Consumer is active')
    })

    consumer.on('jobCompleted', async (job, result) => {
      const jobDuration = dayjs().utc().valueOf() - job.startTimestamp
      
      const meta = {
        route: job.route,
        duration: jobDuration,
        ...(job.meta?.feedURL && { feedURL: job.meta?.feedURL }),
      }

      try {
        await amqpChannelWrapper.sendToQueue(AmqpChannel.FeedArticleDeliveryResult, Buffer.from(JSON.stringify({
          job,
          result,
        })), {
          persistent: true,
        })
      } catch (err) {
        log.debug(`Failed to send feed delivery result to queue`, err)
        logDatadog('error', `Failed to send feed delivery result to queue`, {
          stack: (err as Error).stack
        })
      }

      if (result.status >= 200 && result.status < 300) {
        log.debug(`Article delivered`, result)
        logDatadog('info', `Article delivered`, meta)
      } else {
        log.debug(`Article delivery failed`, result)
        logDatadog('warn', `Article delivery failed`, {
          ...meta,
          status: result.status,
          body: result.body
        })
      }

      if (!job.meta?.articleID) {
        return
      }

      try {
        await recordArticleSuccess(orm, {
          id: job.id,
          duration: jobDuration,
          feedId: job.meta.feedId
        }, job.meta as ArticleMeta)

        if (result.status > 300) {
          await recordArticleFailure(orm, {
            id: job.id,
            duration: jobDuration,
            feedId: job.meta.feedId
          }, job.meta as ArticleMeta, `Bad status code (${result.status}) | ${JSON.stringify(result.body)}`)

          if (result.status === 400) {
            await disableFeed(orm, job.meta.feedId, BAD_FORMAT)
            const userFormattedMessage = BAD_FORMAT + ` (URL ${job.meta.feedURL} in channel <#${job.meta.channel}>)`
            await sendAlert({
              orm,
              producer,
              channelId: job.meta.channel,
              errorMessage: userFormattedMessage,
              guildId: job.meta.guildId
            })
          }
        }
      } catch (err) {
        const errMessage = `Failed to handle job completed: ${(err as Error).message}`
        log.error(errMessage)
        logDatadog('error', errMessage, {
          stack: (err as Error).stack
        })
      }
    })

    consumer.on('jobError', async (error, job) => {
      const errorMessage = `Failed to process job ${job.id}: ${error.message}`
      const debugHistory = (error as RequestTimeoutError).debugHistory || ['no-debug-history']
      log.error(`Job ${job.id} error: ${error.message}`, {
        debugHistory
      })
      logDatadog('error', errorMessage, {
        stack: (error as Error).stack,
        debugHistory,
      })
      const jobDuration = dayjs().utc().valueOf() - job.startTimestamp

      if (!job.meta?.articleID) {
        return
      }
      await recordArticleFailure(orm, {
        id: job.id,
        duration: jobDuration,
        feedId: job.meta.feedId
      }, job.meta as ArticleMeta, `Job error: ${error.message}`)
    })

    /**
     * Log all the important events that might affect this service's performance
     */
    consumer.on('globalBlock', (blockType, durationMs, debugDetails) => {
      let errorMessage: string
      
      if (blockType === GLOBAL_BLOCK_TYPE.GLOBAL_RATE_LIMIT) {
        errorMessage = `Global block: Global rate limit hit (retry after ${durationMs}ms)`
      } else if (blockType === GLOBAL_BLOCK_TYPE.CLOUDFLARE_RATE_LIMIT) {
        errorMessage = `Global block: Cloudflare rate limit hit (retry after ${durationMs}ms)`
      } else if (blockType === GLOBAL_BLOCK_TYPE.INVALID_REQUEST) {
        errorMessage = `Global block: Invalid requests threshold reached, delaying all requests by ${durationMs}ms`
      } else {
        errorMessage = `Global block: type ${blockType}, delaying all requests by ${durationMs}ms`
      }

      logDatadog('warn', errorMessage, {
        durationMs,
        debugDetails
      })
      log.warn(errorMessage)
    })

    await producer.initialize()
    await consumer.initialize()

    log.info('Ready')
  } catch (err) {
    log.error(err)
  }
})

