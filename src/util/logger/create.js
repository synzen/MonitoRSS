const pino = require('pino')
const serializers = require('./serializers.js')

function createLogger (shardID) {
  return pino({
    base: {
      shardID: String(shardID)
    },
    prettyPrint: {
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      messageFormat: `[{shardID}] \x1b[0m{msg}`,
      ignore: 'hostname,shardID'
    },
    serializers: {
      guild: serializers.guild,
      textChannel: serializers.textChannel,
      role: serializers.textChannel,
      user: serializers.user
    },
    enabled: !process.env.TEST_ENV
  })
}

module.exports = createLogger
