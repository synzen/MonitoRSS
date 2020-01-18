const Blacklist = require('../../structs/db/Blacklist.js')
const listeners = require('../../util/listeners.js')
const log = require('../../util/logger.js')

module.exports = async (bot, message, Manager) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]
  try {
    const blacklisted = await Blacklist.get(id)
    if (blacklisted) {
      return await message.channel.send(`Target is already blacklisted.`)
    }
    const results = await bot.shard.broadcastEval(`
      const guild = this.guilds.get('${id}');
      const user = this.users.get('${id}');
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
      return await message.channel.send('No such guild or user exists.')
    }
    const data = {
      _id: id,
      type: found.type === 'guild' ? Blacklist.TYPES.GUILD : Blacklist.TYPES.USER,
      name: found.name
    }

    const blacklist = new Blacklist(data)
    await blacklist.save()

    if (found.type === 'guild') {
      listeners.blacklistCache.guilds.add(id)
    } else {
      listeners.blacklistCache.users.add(id)
    }

    log.owner.info(`Added ${found.type} ${id} named "${found.name}" to blacklist`, message.author)
    await message.channel.send(`Added ${found.type} ${id} named "${found.name}" to blacklist`).catch(err => log.owner.warning('blacklist 2', err))
  } catch (err) {
    log.owner.warning('blacklist', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('blacklist 1b', message.guild, err))
  }
}
