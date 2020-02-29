const pino = require('pino')
const config = require('../../config.js')
const serializers = require('./serializers.js')

function createLogger (shardID) {
  let prettyPrint = {
    translateTime: 'yyyy-mm-dd HH:MM:ss',
    messageFormat: `[{shardID}] \x1b[0m{msg}`,
    ignore: 'hostname,shardID'
  }

  if (!config.log.pretty) {
    prettyPrint = false
  }

  const destination = process.env.DRSS_LOG_DESTINATION
    ? pino.destination(process.env.DRSS_LOG_DESTINATION)
    : undefined

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
      textChannel: serializers.textChannel,
      role: serializers.textChannel,
      user: serializers.user,
      error: pino.stdSerializers.err
    },
    enabled: !process.env.TEST_ENV
  }, destination)
}

module.exports = createLogger
