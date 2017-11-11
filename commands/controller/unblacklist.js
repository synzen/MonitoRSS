const fs = require('fs')
const storage = require('../../util/storage.js')

exports.normal = function (bot, message) {
  const blacklistGuilds = storage.blacklistGuilds
  const content = message.content.split(' ')
  if (content.length !== 2) return

  if (!blacklistGuilds.ids.includes(content[1])) return message.channel.send(`No such blacklisted guild.`)
  const guildID = content[1]
  const guild = this.guilds.get(guildID)
  const guildName = guild ? ` (${guild.name})` : ''

  for (var x in blacklistGuilds.ids) {
    if (blacklistGuilds.ids[x] === guildID) {
      storage.blacklistGuilds.ids.splice(x, 1)
      fs.writeFile('./settings/blacklist.json', JSON.stringify(storage.blacklistGuilds, null, 2), function (err) {
        if (err) throw err
        console.log(`Guild ${guildID}${guildName}has been unblacklisted by (${message.author.id}, ${message.author.username}).`)
        message.channel.send(`Guild ${guildID}${guildName}successfully unblacklisted.`)
      })
      break
    }
  }
}

exports.sharded = function (bot, message, Manager) {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const guildID = content[1]

  bot.shard.broadcastEval(`
    const fs = require('fs');
    const path = require('path');
    const appDir = path.dirname(require.main.filename);
    const storage = require(appDir + '/util/storage.js');
    const currentGuilds = storage.currentGuilds;
    const blacklistGuilds = storage.blacklistGuilds;

    if (blacklistGuilds.ids.includes('${guildID}')) {
      const guild = this.guilds.get('${guildID}');
      const guildName = guild ? ' (' + guild.name + ')' : '';

      for (var x in blacklistGuilds.ids) {
        if (blacklistGuilds.ids[x] === '${guildID}') {
          blacklistGuilds.ids.splice(x, 1);
          try {
            fs.writeFileSync('./settings/blacklist.json', JSON.stringify(storage.blacklistGuilds, null, 2));
            console.log('Guild ${guildID}' + guildName + 'has been unblacklisted by (${message.author.id}, ${message.author.username}).');
            'Guild' + guildName + ' successfully unblacklisted.';
          } catch (e) {
            'Unable to write to file unblacklist operation:\\n' + e.message || e;
          }
          break
        }
      }
    }
  `).then(results => {
    for (var x in results) {
      if (results[x]) return message.channel.send(results[x])
    }
  }).catch(err => {
    console.log(`Unable to broadcast unblacklist eval. `, err.message || err)
    message.channel.send(`Unable to broadcast unblacklist eval. `, err.message || err)
  })
}
