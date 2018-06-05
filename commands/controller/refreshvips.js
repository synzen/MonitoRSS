const dbOps = require('../../util/dbOps.js')
const log = require('../../util/logger.js')

exports.normal = (bot, message) => {
  dbOps.vips.refresh(async err => {
    try {
      if (err) {
        log.controller.error('Failed to refresh VIPs', message.author, err)
        return await message.channel.send(`Failed to refresh VIPs:`, err.message)
      }
      log.controller.success(`Refreshed VIPs`, message.author)
      await message.channel.send(`Refreshed VIPs.`)
    } catch (err) {
      log.controller.warning('refreshvips', err)
    }
  })
}

exports.sharded = exports.normal
