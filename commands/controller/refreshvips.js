const fileOps = require('../../util/fileOps.js')
const log = require('../../util/logger.js')

exports.normal = (bot, message) => {
  fileOps.refreshVIP(err => {
    if (err) {
      log.controller.error('Failed to refresh VIPs', message.author, err)
      return message.channel.send(`Failed to refresh VIPs:`, err.message)
    }
    log.controller.info(`Refreshed VIPs`, message.author)
    message.channel.send(`Refreshed VIPs.`)
  })
}

exports.sharded = exports.normal
