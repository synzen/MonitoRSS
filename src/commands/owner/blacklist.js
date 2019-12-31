const Blacklist = require('../../structs/db/Blacklist.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]
  try {
    const blacklisted = await Blacklist.get(id)
    if (blacklisted) {
      return await message.channel.send(`Target is already blacklisted.`)
    }
    const guild = bot.guilds.get(id)
    const user = bot.users.get(id)
    if (!guild && !user) {
      return await message.channel.send('No such guild or user exists.')
    }
    const data = {
      _id: id,
      type: guild ? Blacklist.TYPES.GUILD : Blacklist.TYPES.USER,
      name: guild ? guild.name : user.username
    }
    const blacklist = new Blacklist(data)
    await blacklist.save()
    if (guild) {
      guild.leave().catch(err => log.general.warning(`Unable to leave guild after blacklisted`, guild, err))
    }
    log.owner.info(`Added ${guild ? `guild ${id} named "${guild.name}"` : `user ${id} named "${user.username}`}" to blacklist`, message.author)
    await message.channel.send(`Added ${guild ? `guild ${id} named "${guild.name}"` : `user ${id} named "${user.username}`}" to blacklist`).catch(err => log.owner.warning('blacklist 2', err))
  } catch (err) {
    log.owner.warning('blacklist', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('blacklist 1a', message.guild, err))
  }
}

exports.sharded = async (bot, message, Manager) => {
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
    log.owner.info(`Added ${found.type} ${id} named "${found.name}" to blacklist`, message.author)
    await message.channel.send(`Added ${found.type} ${id} named "${found.name}" to blacklist`).catch(err => log.owner.warning('blacklist 2', err))
  } catch (err) {
    log.owner.warning('blacklist', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('blacklist 1b', message.guild, err))
  }
}
