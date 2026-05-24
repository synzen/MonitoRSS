import { MikroORM } from "@mikro-orm/mongodb"
import DeliveryRecord from "../entities/DeliveryRecord"
import Feed from "../entities/Feed"
import GeneralStat from "../entities/GeneralStat"
import Profile from "../entities/Profile"
import log from "./log"
import amqp, { Channel } from 'amqp-connection-manager'
import { AmqpChannel } from "../constants/amqpChannels"
import { URL } from "url"
import type { ConfigType } from "../schemas/ConfigSchema"

const pollDb = (orm: MikroORM, dbName: string) => {
  return setInterval(() => {
    orm.em.getConnection().getClient().db(dbName).command({ping: 1}).catch(err => {
      log.error('MongoDB ping failed, shutting down', err.message)
      process.exit(1)
    })
  }, 10000)
}

async function setup (config: ConfigType) {
  log.info('Connecting to Mongo')
  const orm = await MikroORM.init({
    entities: [DeliveryRecord, GeneralStat, Feed, Profile],
    clientUrl: config.databaseURI,
    ensureIndexes: true,
    allowGlobalContext: true,
  })
  log.info('Connected to Mongo')
  const u = new URL(config.databaseURI)
  const databaseName = u.pathname.substring(1).split('?')[0]
  const pollInterval = pollDb(orm, databaseName)


  const amqpConnection = amqp.connect([config.rabbitmqUri])

  const amqpChannelWrapper = amqpConnection.createChannel({
    setup: function(channel: Channel) {
      return Promise.all([
        channel.assertQueue(AmqpChannel.FeedArticleDeliveryResult, {
          durable: true,
        }),
      ])
    }
  })

  return {
    orm,
    amqpChannelWrapper,
    pollInterval,
  }
}

export default setup
