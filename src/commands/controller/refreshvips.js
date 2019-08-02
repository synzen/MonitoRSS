const dbOps = require('../../util/dbOps.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  try {
    await dbOps.vips.refresh()
    log.controller.success(`Refreshed VIPs`, message.author)
    await message.channel.send(`Refreshed VIPs.`)
  } catch (err) {
    log.controller.warning('refreshvips', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('refresh 1a', message.guild, err))
  }
}

exports.sharded = exports.normal
