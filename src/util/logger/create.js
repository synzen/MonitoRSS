const pino = require('pino')
const serializers = require('./serializers.js')
const getConfig = require('../../config.js').get

function createLogger (tag, base = {}) {
  const config = getConfig()
  const prettyPrint = {
    translateTime: 'yyyy-mm-dd HH:MM:ss',
    messageFormat: '[{tag}] \x1b[0m{msg}',
    ignore: 'hostname,tag'
  }

  const pinoConfig = {
    base: {
      tag: String(tag),
      ...base
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
      message: serializers.message,
      error: pino.stdSerializers.err
    },
    enabled: process.env.NODE_ENV !== 'test'
  }

  let destination
  if (pinoConfig.enabled) {
    destination = config.log.destination || undefined
    pinoConfig.level = config.log.level
    pinoConfig.prettyPrint = !destination ? prettyPrint : false
  }

  return pino(pinoConfig, pino.destination(destination))
}

module.exports = createLogger
