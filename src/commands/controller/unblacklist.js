const storage = require('../../util/storage.js')
const dbOps = require('../../util/dbOps.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]
  try {
    if (!storage.blacklistUsers.includes(id) && !storage.blacklistGuilds.includes(id)) return message.channel.send(`ID ${id} is not blacklisted.`)
    await dbOps.blacklists.remove(id)
    log.controller.success(`Removed ${id} from blacklist`)
    await message.channel.send(`Removed ${id} from blacklist.`)
  } catch (err) {
    log.controller.warning('unblacklist', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('unblacklist 1a', message.guild, err))
  }
}

exports.sharded = exports.normal
