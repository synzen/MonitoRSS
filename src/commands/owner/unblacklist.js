const Blacklist = require('../../structs/db/Blacklist.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]
  try {
    const blacklisted = await Blacklist.get(id)
    if (!blacklisted) {
      return message.channel.send(`ID ${id} is not blacklisted.`)
    } else {
      await blacklisted.delete()
    }
    log.owner.success(`Removed ${id} from blacklist`)
    await message.channel.send(`Removed ${id} from blacklist.`)
  } catch (err) {
    log.owner.warning('unblacklist', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('unblacklist 1a', message.guild, err))
  }
}

exports.sharded = exports.normal
