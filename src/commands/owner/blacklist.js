const Blacklist = require('../../structs/db/Blacklist.js')
const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]
  const blacklisted = await Blacklist.get(id)
  if (blacklisted) {
    return message.channel.send('ID is already blacklisted.')
  }
  const data = {
    _id: id
  }
  const log = createLogger(message.guild.shard.id)
  const guildResults = await message.client.shard.broadcastEval(`this.guilds.cache.get('${id}') ? this.guilds.cache.get('${id}').name : null`)
  const matchedGuilds = guildResults.filter(g => g)
  if (matchedGuilds.length > 0) {
    data.type = Blacklist.TYPES.GUILD
    data.name = matchedGuilds[0]
  } else {
    /**
     * @type {import('discord.js').Client}
     */
    const client = message.client
    try {
      const user = await client.users.fetch(id)
      data.type = Blacklist.TYPES.USER
      data.name = user.username
    } catch (err) {
      log.owner({
        error: err
      }, `No guild or user found for ${id}. User fetch result:`)
      return message.channel.send(`No guild or user found for id ${id}.`)
    }
  }

  const blacklist = new Blacklist(data)
  await blacklist.save()

  log.owner({
    guild: message.guild,
    user: message.author
  }, `Added ${data.type} ${id} named "${data.name}" to blacklist`)
  await message.channel.send(`Added ${data.type === 0 ? 'user' : 'guild'} ${id} named "${data.name}" to blacklist. Restart bot to take effect.`)
}
