const Patron = require('../../structs/db/Patron.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  try {
    await Patron.refresh()
    log.owner.success(`Refreshed VIPs`, message.author)
    await message.channel.send(`Refreshed VIPs.`)
  } catch (err) {
    log.owner.warning('refreshvips', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('refresh 1a', message.guild, err))
  }
}

exports.sharded = exports.normal
