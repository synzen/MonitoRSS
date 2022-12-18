import { MikroORM } from "@mikro-orm/core"
import DeliveryRecord from "../entities/DeliveryRecord"
import Feed from "../entities/Feed"
import GeneralStat from "../entities/GeneralStat"
import Profile from "../entities/Profile"
import config from "./config"
import log from "./log"
import amqp, { Channel } from 'amqp-connection-manager'
import { AmqpChannel } from "../constants/amqpChannels"

async function setup () {
  log.info('Connecting to Mongo')
  const orm = await MikroORM.init({
    entities: [DeliveryRecord, GeneralStat, Feed, Profile],
    type: 'mongo',
    clientUrl: config.databaseURI,
    ensureIndexes: true
  })
  log.info('Connected to Mongo')

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
    amqpChannelWrapper
  }
}

export default setup
