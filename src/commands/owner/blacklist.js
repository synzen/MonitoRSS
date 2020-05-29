const Blacklist = require('../../structs/db/Blacklist.js')
const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]
  const blacklisted = await Blacklist.get(id)
  if (blacklisted) {
    return message.channel.send('Target is already blacklisted.')
  }
  const results = await message.client.shard.broadcastEval(`
    const guild = this.guilds.cache.get('${id}');
    const user = this.users.cache.get('${id}');
    // guild ? guild.leave() : null;
    guild ? '_guild ' + guild.name : user ? '_user ' + user.username : null
  `)
  let found
  for (let x = 0; x < results.length; ++x) {
    if (!results[x]) continue
    const arr = results[x].split(' ')
    const type = arr.shift().replace('_', '')
    found = {
      type,
      name: arr.join(' ')
    }
  }
  if (!found) {
    return message.channel.send('No such guild or user exists.')
  }
  const data = {
    _id: id,
    type: found.type === 'guild' ? Blacklist.TYPES.GUILD : Blacklist.TYPES.USER,
    name: found.name
  }

  const blacklist = new Blacklist(data)
  await blacklist.save()

  const log = createLogger(message.guild.shard.id)
  log.owner({
    guild: message.guild,
    user: message.author
  }, `Added ${found.type} ${id} named "${found.name}" to blacklist`)
  await message.channel.send(`Added ${found.type} ${id} named "${found.name}" to blacklist. Restart bot to take effect.`)
}
