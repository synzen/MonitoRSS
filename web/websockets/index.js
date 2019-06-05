const { httpSocketsByGuildId, httpsSocketsByGuildId, guildIdsByHttpSockets, guildIdsByHttpsSockets } = require('./util/directory.js')
const dbOps = require('../../util/dbOps.js')
const log = require('../../util/logger.js')

module.exports = (io, isHttps) => {
  const socketFunctions = socket => {
    if (!socket.handshake.session.auth) return
    return {
      identify: async guildId => {
        if (!guildId) return log.web.warning('Invalid identify socket event', guildId)
        const socketId = socket.id
        // const session = socket.handshake.session
        const guildIdsBySockets = isHttps ? guildIdsByHttpsSockets : guildIdsByHttpSockets
        if (!Array.isArray(guildIdsBySockets[socketId])) {
          guildIdsBySockets[socketId] = [ guildId ]
        } else if (!guildIdsBySockets[socketId].includes(guildId)) {
          guildIdsBySockets[socketId].push(guildId)
        }

        const socketsByGuildId = isHttps ? httpsSocketsByGuildId : httpSocketsByGuildId
        if (!Array.isArray(socketsByGuildId[guildId])) {
          socketsByGuildId[guildId] = [ socketId ]
        } else if (!socketsByGuildId[guildId].includes(socketId)) {
          socketsByGuildId[guildId].push(socketId)
        }
      },
      getLinkStatus: async link => {
        try {
          let status
          const doc = await dbOps.failedLinks.get(link)
          if (!doc) status = 0 // OK
          else if (doc.failed) status = doc.failed // FAILED
          else status = doc.count // OK so far
          socket.emit('linkStatus', JSON.stringify({ link, status }))
        } catch (err) {
          log.web.err('Failed to get link status after websocket request', err)
        }
      }
    }
  }

  io.on('connection', socket => {
    const functions = socketFunctions(socket)
    if (!functions) return
    for (const eventName in functions) {
      socket.on(eventName, functions[eventName])
    }

    socket.once('disconnect', () => {
      for (const eventName in functions) {
        socket.removeListener(eventName, functions[eventName])
      }
      const socketGuilds = isHttps ? guildIdsByHttpsSockets[socket.id] : guildIdsByHttpSockets[socket.id]
      if (!socketGuilds) return
      for (const guildId of socketGuilds) {
        const guildSockets = isHttps ? httpsSocketsByGuildId[guildId] : httpSocketsByGuildId[guildId]
        if (!guildSockets) continue
        // log.web.info(`[WEBSOCKETS] ${socket.id} deregistered for guild ${guildId}`)
        guildSockets.splice(guildSockets.indexOf(socket.id), 1)
      }
      delete (isHttps ? guildIdsByHttpsSockets[socket.id] : guildIdsByHttpSockets[socket.id])
    })
  })
}
