const storage = require('../../util/storage.js')
const fileOps = require('../../util/fileOps.js')
const blacklistGuilds = storage.blacklistGuilds
const blacklistUsers = storage.blacklistUsers
const log = require('../../util/logger.js')

exports.normal = (bot, message) => {
  const blacklistGuilds = storage.blacklistGuilds

  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]

  const guild = bot.guilds.get(id)
  const user = bot.users.get(id)
  if (!guild && !user) return message.channel.send('No such guild or user exists.')
  else if (guild && blacklistGuilds.includes(id)) return message.channel.send(`Guild ${id} (${user.username}) is already blacklisted.`)
  else if (user && blacklistUsers.includes(id)) return message.channel.send(`User ${id} (${user.username}) is already blacklisted.`)

  fileOps.addBlacklist({ isGuild: !!guild, id: id, name: guild ? guild.name : user.username }, err => {
    if (err) {
      log.controller.error('Unable to add blacklist', message.author, err)
      return message.channel.send(`Blacklist failed. ${err.message}`)
    }
    if (guild) guild.leave().catch(err => log.general.warning(`Unable to leave guild after blacklisted`, guild, err))
    message.channel.send(`Added ${guild ? `guild ${id} named "${guild.name}"` : `user ${id} named "${user.username}`}" to blacklist`)
    log.controller.info(`Added ${guild ? `guild ${id} named "${guild.name}"` : `user ${id} named "${user.username}`}" to blacklist`, message.author)
  })
}

exports.sharded = function (bot, message, Manager) {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]

  bot.shard.broadcastEval(`
    const guild = this.guilds.get('${id}');
    const user = this.users.get('${id}');
    if (guild) guild.leave();
    guild ? '_guild ' + guild.name : user ? '_user ' + user.username : null
  `).then(results => {
    let found
    for (var x = 0; x < results.length; ++x) {
      if (!results[x]) continue
      const arr = results[x].split(' ')
      const type = arr.shift().replace('_', '')
      found = { type: type, name: arr.join(' ') }
    }
    if (!found) return message.channel.send('No such guild or user exists.')
    else if (found.type === 'guild' && blacklistGuilds.includes(id)) return message.channel.send(`Guild ${id} (${found.name}) is already blacklisted.`)
    else if (found.type === 'user' && blacklistUsers.includes(id)) return message.channel.send(`User ${id} (${found.name}) is already blacklisted.`)

    fileOps.addBlacklist({ isGuild: found.type === 'guild', id: id, name: found.name }, err => {
      if (err) {
        log.controller.error('Unable to add blacklist', message.author, err)
        return message.channel.send(`Blacklist failed. ${err.message}`)
      }
      message.channel.send(`Added ${found.type} ${id} named "${found.name}" to blacklist`)
      log.controller.info(`Added ${found.type} ${id} named "${found.name}" to blacklist`, message.author)
    })
  }).catch(err => {
    log.controller.error(`Unable to broadcast eval blacklist`, message.author, err)
    message.channel.send(`Unable to broadcast eval blacklist, reason:\n`, err.message || err)
  })
}
