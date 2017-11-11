const fs = require('fs')
const storage = require('../../util/storage.js')
const removeRss = require('../../util/removeRss.js')

exports.normal = function (bot, message) {
  const currentGuilds = storage.currentGuilds
  const blacklistGuilds = storage.blacklistGuilds

  const content = message.content.split(' ')
  if (content.length !== 2) return
  const guildID = content[1]

  const guild = bot.guilds.get(guildID)
  if (!guild) return message.channel.send('No such guild exists.')
  if (blacklistGuilds.ids.includes(guildID)) return message.channel.send(`Guild ${guildID} (${guild.name}) is already blacklisted.`)

  blacklistGuilds.ids.push(guildID)

  fs.writeFile('./settings/blacklist.json', JSON.stringify(blacklistGuilds, null, 2), function (err) {
    if (err) {
      console.log(`Bot Controller: Unable to permanently blacklist (${guildID} ${guild.name}) as requested by (${message.author.id}, ${message.author.username}), reason: `, err)
      return message.channel.send(`Unable to permanently blacklist. Reason: `, err)
    }
    try {
      fs.unlinkSync(`./sources/${guildID}.json`)
      const guildRss = currentGuilds.get(guildID)
      if (guildRss) {
        for (var rssName in guildRss.sources) {
          removeRss(guildID, rssName, function (link, rssName) {
            console.log(`Bot Controller: Removed ${rssName} has part of blacklist operation.`)
          })
        }
        currentGuilds.delete(guildID)
      }
      console.log(`Bot Controller: Successfully blacklisted guild (${guildID} ${guild.name}) and deleted source file as requested by (${message.author.id}, ${message.author.username}).`)
      message.channel.send(`Successfully blacklisted guild ${guildID} (${guild.name}) and deleted source file.`)
    } catch (e) {
      console.log(`Bot Controller: Successfully blacklisted, but unable to delete source file for guild (${guildID} ${guild.name}) as requested by (${message.author.id}, ${message.author.username}). Reason: `, e)
    }
  })
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
    const removeRss = require(appDir + '/util/removeRss.js');
    const currentGuilds = storage.currentGuilds;
    const blacklistGuilds = storage.blacklistGuilds;

    const guild = this.guilds.get('${guildID}');
    if (guild) {
      const guildName = guild.name;
      const guildID = guild.id;
      if (!blacklistGuilds.ids.includes(guildID)) {

        blacklistGuilds.ids.push(guildID);

        try {
          fs.writeFileSync('./settings/blacklist.json', JSON.stringify(blacklistGuilds, null, 2));
          try {
            fs.unlinkSync('./sources/' + guildID + '.json');
            const guildRss = currentGuilds.get(guildID);
            if (guildRss) {
              for (var rssName in guildRss.sources) {
                removeRss(guildID, rssName, function (link, rssName) {
                  console.log('Bot Controller: Removed ' + rssName + ' has part of blacklist operation.');
                });
              }
              currentGuilds.delete(guildID);
            }
            console.log('Bot Controller: Successfully blacklisted guild (' + guildID + ', ' + guildName + ') and deleted source file as requested by (${message.author.id}, ${message.author.username}).');
            'Successfully blacklisted guild ' + guildID + ' (' + guildName + ') and deleted source file.';
          } catch (e) {
            console.log('Bot Controller: Successfully blacklisted, but unable to delete source file for guild (' + guildID + ', ' + guildName + ') as requested by (${message.author.id}, ${message.author.username}). Reason: ', e);
            'Successfully blacklisted, but unable to delete source file for guild:\\n' + e.message || e;
          }
        } catch (err) {
          console.log('Bot Controller: Unable to permanently blacklist (' + guildID + ', ' +  guild.name + ') as requested by (${message.author.id}, ${message.author.username}), reason: ', err);
          'Unable to permanently blacklist. Reason:\\n' + err.message || err;
        }

      } else 'Guild ' + guildID + '(' + guildName + ') is already blacklisted.';
    }
  `).then(results => {
    for (var x in results) {
      const result = results[x]
      if (result) message.channel.send(result)
    }
  }).catch(err => {
    console.log(`Bot Controller: Unable to broadcast eval blacklist, reason:\n`, err.message || err)
    message.channel.send(`Bot Controller: Unable to broadcast eval blacklist, reason:\n`, err.message || err)
  })
}
