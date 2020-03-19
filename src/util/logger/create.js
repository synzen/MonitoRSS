const pino = require('pino')
const serializers = require('./serializers.js')
const getConfig = require('../../config.js').get

function createLogger (shardID) {
  const config = getConfig()
  let prettyPrint = {
    translateTime: 'yyyy-mm-dd HH:MM:ss',
    messageFormat: `[{shardID}] \x1b[0m{msg}`,
    ignore: 'hostname,shardID'
  }

  let destination

  if (process.env.NODE_ENV !== 'test' && config.log.destination) {
    destination = pino.destination(config.log.destination)
    prettyPrint = false
  }

  return pino({
    base: {
      shardID: String(shardID)
    },
    customLevels: {
      owner: 35
    },
    prettyPrint,
    serializers: {
      guild: serializers.guild,
      channel: serializers.channel,
      role: serializers.channel,
      user: serializers.user,
      error: pino.stdSerializers.err
    },
    enabled: !process.env.TEST_ENV
  }, destination)
}

module.exports = createLogger
