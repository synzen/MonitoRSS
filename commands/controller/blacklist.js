const storage = require('../../util/storage.js')
const dbOps = require('../../util/dbOps.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]
  try {
    const guild = bot.guilds.get(id)
    const user = bot.users.get(id)
    if (!guild && !user) return await message.channel.send('No such guild or user exists.')
    else if (guild && storage.blacklistGuilds.includes(id)) return await message.channel.send(`Guild ${id} (${user.username}) is already blacklisted.`)
    else if (user && storage.blacklistUsers.includes(id)) return await message.channel.send(`User ${id} (${user.username}) is already blacklisted.`)

    await dbOps.blacklists.add({ isGuild: !!guild, id: id, name: guild ? guild.name : user.username })
    if (guild) guild.leave().catch(err => log.general.warning(`Unable to leave guild after blacklisted`, guild, err))
    log.controller.info(`Added ${guild ? `guild ${id} named "${guild.name}"` : `user ${id} named "${user.username}`}" to blacklist`, message.author)
    await message.channel.send(`Added ${guild ? `guild ${id} named "${guild.name}"` : `user ${id} named "${user.username}`}" to blacklist`).catch(err => log.controller.warning('blacklist 2', err))
  } catch (err) {
    log.controller.warning('blacklist', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('blacklist 1a', message.guild, err))
  }
}

exports.sharded = async (bot, message, Manager) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]
  try {
    const results = await bot.shard.broadcastEval(`
      const guild = this.guilds.get('${id}');
      const user = this.users.get('${id}');
      guild.leave();
      guild ? '_guild ' + guild.name : user ? '_user ' + user.username : null
    `)
    let found
    for (var x = 0; x < results.length; ++x) {
      if (!results[x]) continue
      const arr = results[x].split(' ')
      const type = arr.shift().replace('_', '')
      found = { type: type, name: arr.join(' ') }
    }
    if (!found) return await message.channel.send('No such guild or user exists.')
    else if (found.type === 'guild' && storage.blacklistGuilds.includes(id)) return await message.channel.send(`Guild ${id} (${found.name}) is already blacklisted.`)
    else if (found.type === 'user' && storage.blacklistUsers.includes(id)) return await message.channel.send(`User ${id} (${found.name}) is already blacklisted.`)

    await dbOps.blacklists.add({ isGuild: found.type === 'guild', id: id, name: found.name })
    log.controller.info(`Added ${found.type} ${id} named "${found.name}" to blacklist`, message.author)
    await message.channel.send(`Added ${found.type} ${id} named "${found.name}" to blacklist`).catch(err => log.controller.warning('blacklist 2', err))
  } catch (err) {
    log.controller.warning('blacklist', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('blacklist 1b', message.guild, err))
  }
}
