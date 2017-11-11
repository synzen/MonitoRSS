const storage = require('../../util/storage.js')

exports.normal = function (bot, message) {
  const currentGuilds = storage.currentGuilds
  const content = message.content.split(' ')
  if (content.length !== 2) return
  let found = false

  currentGuilds.forEach(function (guildRss, guildId) {
    if (found) return
    const rssList = guildRss.sources
    for (var rssName in rssList) {
      if (rssName === content[1]) {
        found = true
        return message.channel.send(`Found guild ID: ${guildId}`)
      }
    }
  })

  if (!found) message.channel.send(`Could not find any feeds with that rssName.`)
}

exports.sharded = function (bot, message, Manager) {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const rssName = content[1]

  bot.shard.broadcastEval(`
    const appDir = require('path').dirname(require.main.filename);
    const currentGuilds = require(appDir + '/util/storage.js').currentGuilds;
    let found = false;

    currentGuilds.forEach(function (guildRss, guildId) {
      if (found) return;
      const rssList = guildRss.sources;
      for (var rssName in rssList) {
        if (rssName === '${rssName}') return found = guildId;
      }
    });

    found;
  `).then(results => {
    for (var x in results) {
      if (results[x]) return message.channel.send(`Found guild ID ${results[x]}`)
    }
    message.channel.send('Could not find any guilds with feeds identified by that rssName.')
  }).catch(err => console.log(`Bot Controller: Unable to broadcast eval feedguild. `, err.message || err))
}
