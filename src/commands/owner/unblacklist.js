const Blacklist = require('../../structs/db/Blacklist.js')
const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]
  const blacklisted = await Blacklist.get(id)
  if (!blacklisted) {
    return message.channel.send(`ID ${id} is not blacklisted.`)
  } else {
    await blacklisted.delete()
  }
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author
  }, `Removed ${id} from blacklist`)
  await message.channel.send(`Removed ${id} from blacklist. Restart bot to take effect.`)
}
