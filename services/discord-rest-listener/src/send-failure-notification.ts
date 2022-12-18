import { MikroORM } from "@mikro-orm/core";
import Feed from "./entities/Feed";
import { ObjectId } from '@mikro-orm/mongodb'
import { RESTProducer } from "@synzen/discord-rest";
import Profile from "./entities/Profile";
import log, { logDatadog } from "./utils/log";

export async function disableFeed(orm: MikroORM, feedId: string, reason: string) {
  try {
    const repo = orm.em.getRepository(Feed)
    await repo.nativeUpdate({
      _id: new ObjectId(feedId)
    }, {
      disabled: reason
    })
  } catch (err) {
    const errorMessage = `Failed to disable feed ${feedId}: ${(err as Error).message}`
    log.error(errorMessage)
    logDatadog('error', errorMessage, {
      stack: (err as Error).stack
    })
  }
}

export async function sendAlert({
  orm,
  channelId,
  errorMessage,
  guildId,
  producer
}: {
  orm: MikroORM,
  producer: RESTProducer,
  guildId: string,
  channelId: string,
  errorMessage: string
}) {
  const userAlerts = await getUserAlerts(orm, guildId)
  if (!userAlerts) {
    return await sendMessageToChannel(producer, channelId, errorMessage)
  }

  await Promise.all(userAlerts.map((id) => sendMessageToUser(producer, id, errorMessage)))
}

async function sendMessageToChannel(producer: RESTProducer, channelId: string, content: string) {
  try {
      await producer.enqueue(`https://discord.com/api/channels/${channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            content
          })
      })
  } catch (err) {
    const errMessage = `Failed to send alert to channel ${channelId}: ${(err as Error).message}`
    log.error(errMessage)
    logDatadog('warn', `Failed to send alert to channel ${channelId}: ${(err as Error).message}`, {
      stack: (err as Error).stack
    })
  }
}

async function sendMessageToUser(producer: RESTProducer, userId: string, content: string) {
  try {
    const createDmResponse = await producer.fetch(`https://discord.com/api/users/@me/channels`, {
        method: 'POST',
        body: JSON.stringify({
            recipient_id: userId
        })
    })

    if (createDmResponse.state === 'error') {
      throw new Error(`Producer fetch to create a DM channel resulted in an error`)
    }

    const { body: createDmBody, status: createDmStatusCode } = createDmResponse

    if (createDmStatusCode !== 200) {
      throw new Error(`Bad status code fetching DM channel for ${userId}`)
    }

    const channelId = (createDmBody as Record<string, any>).id
    const createMessageResponse = await producer.fetch(`https://discord.com/api/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
            content
        })
    })

    if (createMessageResponse.state === 'error') {
      throw new Error('Producer fetch to create message resulted in an error')
    }

    const { status: createMessageStatusCode } = createMessageResponse

    if (createMessageStatusCode !== 200) {
      throw new Error(`${createMessageStatusCode} status code when sending message to ${userId}`)
    }
  } catch (err) {
    const errMessage = `Failed to send alert to user ${userId}: ${(err as Error).message}.`
    log.warn(errMessage)
    logDatadog('warn', errMessage, {
      stack: (err as Error).message
    })
  }
}

async function getUserAlerts(orm: MikroORM, guildId: string) {
  const repo = orm.em.getRepository(Profile)
  const profile = await repo.findOne({
    _id: guildId
  })

  if (!profile || !profile.alert || !profile.alert.length) {
      return null
  }

  return profile.alert
}