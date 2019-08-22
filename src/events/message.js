const config = require('../config.js')
const commands = require('../util/commands.js')
const channelTracker = require('../util/channelTracker.js')
const storage = require('../util/storage.js')

const ownerIDs = new Set()

for (const id of config.bot.ownerIDs) {
  ownerIDs.add(id)
}

module.exports = (message, limited) => {
  if (message.author.bot || !message.guild || storage.blacklistGuilds.includes(message.guild.id) || storage.blacklistUsers.includes(message.author.id)) {
    return
  }

  const command = message.content.split(' ')[0].substr(config.bot.prefix.length)
  if (command === 'forceexit') {
    return require(`../commands/forceexit.js`)(message.client, message) // To forcibly clear a channel of active menus
  }

  if (channelTracker.hasActiveMenus(message.channel.id)) {
    return
  }

  // Regular commands
  if ((!limited && commands.has(message)) || (limited && ownerIDs.has(message.author.id) && commands.has('message'))) {
    if (storage.initialized < 2) return message.channel.send(`This command is disabled while booting up, please wait.`).then(m => m.delete(4000))
    return commands.run(message)
  }

  // Bot owner commands
  if (ownerIDs.has(message.author.id)) {
    commands.runOwner(message)
  }
}
