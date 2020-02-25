const pino = require('pino')
const serializers = require('./serializers.js')

const log = pino({
  base: {
      shardID: process.env.SHARD_ID
  },
  prettyPrint: {
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      messageFormat: `[{shardID}] {msg}`,
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


module.exports = log
