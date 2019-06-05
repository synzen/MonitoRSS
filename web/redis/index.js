const config = require('../../config.js')
const dbOps = require('../../util/dbOps.js')
const log = require('../../util/logger.js')
const redisOps = require('../../util/redisOps.js')
const subscriber = require('redis').createClient(config.database.redis)
const DRSS_PROFILE_UPDATE_EVENT = redisOps.events.NAMES.DRSS_PROFILE_UPDATE
const SOURCE_SCHEDULE_UPDATE_EVENT = redisOps.events.NAMES.SOURCE_SCHEDULE_UPDATE
const { httpSocketsByGuildId, httpsSocketsByGuildId } = require('../websockets/util/directory.js')
const allSocketsByGuildId = [ httpSocketsByGuildId, httpsSocketsByGuildId ]

module.exports = (httpIo, httpsIo) => {
  subscriber.on('message', (channel, message) => {
    if (channel.startsWith(DRSS_PROFILE_UPDATE_EVENT)) {
      const guildId = message
      dbOps.guildRss.get(guildId).then(guildRss => {
        allSocketsByGuildId.forEach((socketsByGuildId, i) => {
          if (i === 1 && !httpsIo) return
          const socketIds = socketsByGuildId[guildId]
          if (socketIds) {
            for (const socketId of socketIds) {
              const socket = i === 1 ? httpsIo.sockets.connected[socketId] : httpIo.sockets.connected[socketId]
              if (socket) socket.emit(DRSS_PROFILE_UPDATE_EVENT, JSON.stringify({ id: guildId, profile: guildRss }))
            }
          }
        })
      }).catch(err => log.web.warning(`Unable to send ${DRSS_PROFILE_UPDATE_EVENT} for ${guildId}`, err))
    } else if (channel === SOURCE_SCHEDULE_UPDATE_EVENT) {
      const { guildId } = JSON.parse(message)
      allSocketsByGuildId.forEach((socketsByGuildId, i) => {
        if (i === 1 && !httpsIo) return
        const socketIds = socketsByGuildId[guildId]
        if (socketIds) {
          for (const socketId of socketIds) {
            const socket = i === 1 ? httpsIo.sockets.connected[socketId] : httpIo.sockets.connected[socketId]
            if (socket) socket.emit(SOURCE_SCHEDULE_UPDATE_EVENT, message)
          }
        }
      })
    }
  })

  subscriber.subscribe(DRSS_PROFILE_UPDATE_EVENT)
}
