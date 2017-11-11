const fs = require('fs')
const storage = require('../../util/storage.js')
const config = require('../../config.json')
const removeRss = require('../../util/removeRss.js')

exports.normal = function (bot, message) {
  const defLimit = config.feedSettings.maxFeeds
  const currentGuilds = storage.currentGuilds
  const overriddenGuilds = storage.overriddenGuilds

  const content = message.content.split(' ')
  if (content.length < 2 || content.length > 3) return message.channel.send(`The proper syntax to override a server's feed limit is \`${config.botSettings.prefix}removeoverride <guildID>\`.`)
  const guildID = content[1]

  if (overriddenGuilds[guildID]) {
    delete overriddenGuilds[guildID]
    try {
      fs.writeFileSync('./settings/limitOverrides.json', JSON.stringify(overriddenGuilds, null, 2))
      let enforced

      if (content[2] === 'enforce') {
        enforced = 0
        const guildRss = currentGuilds.get(guildID)
        const rssList = guildRss.sources
        if (rssList.size() > defLimit) {
          for (var rssName in rssList) {
            if (rssList.size() > defLimit) {
              enforced++
              removeRss(guildID, rssName)
              delete rssList[rssName]
            }
          }
        }
        if (enforced && fs.existsSync(`./sources/${guildID}.json`)) {
          fs.writeFile(`./sources/${guildID}.json`, JSON.stringify(guildRss), function (err) {
            if (err) throw err
          })
        }
      }

      const enforceTxt = enforced ? ` Limit has been enforced, ${enforced} feeds have been removed.` : ''
      message.channel.send(`Override limit reset for guild ID ${guildID}.${enforceTxt}`)
      console.log(`Bot Controller: Override limit reset for guild ID ${guildID}.${enforceTxt} By (${message.author.id}, ${message.author.username})`)
      return true
    } catch (e) {
      console.log(`Bot Controller: Unable to write to file limitOverrides for command removeoverride: `, e.message || e)
      message.channel.send(`Unable to write to file limitOverrides for command removeoverride.\n`, e.message || e)
    }
  } else return message.channel.send(`Unable to reset, there are no overrides set for that guild.`)
}

exports.sharded = function (bot, message, Manager) {
  const overriddenGuilds = storage.overriddenGuilds

  const content = message.content.split(' ')
  if (content.length < 2 || content.length > 3) return message.channel.send(`The proper syntax to override a server's feed limit is \`${config.botSettings.prefix}removeoverride <guildID>\`.`)
  const guildID = content[1]
  const enforce = content[2]

  if (bot.guilds.get(guildID)) {
    if (exports.normal(bot, message)) {
      bot.shard.broadcastEval(`
        const appDir = require('path').dirname(require.main.filename);
        delete require(appDir + '/util/storage.js').overriddenGuilds['${guildID}'];
      `).catch(err => {
        console.log(`Bot Controller: Unable to update overriddenGuilds after normal removeoverride: `, err.message || err)
      })
    }
    return
  }

  if (!overriddenGuilds[guildID]) return message.channel.send(`Unable to reset, there are no overrides set for that guild.`)
  bot.shard.broadcastEval(`
    const fs = require('fs');
    const appDir = require('path').dirname(require.main.filename);
    const config = require(appDir + '/config.json');
    const storage = require(appDir + '/util/storage.js');
    const prefix = config.botSettings.prefix;
    const defLimit = config.feedSettings.maxFeeds;
    const currentGuilds = storage.currentGuilds;
    const overriddenGuilds = storage.overriddenGuilds;

    if (this.guilds.has('${guildID}')) {
      delete overriddenGuilds['${guildID}'];
      try {
        fs.writeFileSync('./settings/limitOverrides.json', JSON.stringify(overriddenGuilds, null, 2));
        let enforced;

        if ('${enforce}' === 'enforce') {
          enforced = 0;
          const guildRss = currentGuilds.get('${guildID}');
          const rssList = guildRss.sources;
          if (rssList.size() > defLimit) {
            for (var rssName in rssList) {
              if (rssList.size() > defLimit) {
                enforced++;
                removeRss('${guildID}', rssName);
                delete rssList[rssName];
              }
            }
          }
          if (enforced && fs.existsSync('./sources/${guildID}.json')) {
            fs.writeFile('./sources/${guildID}.json', JSON.stringify(guildRss), function (err) {
              if (err) throw err;
            })
          }
        }

        const enforceTxt = enforced ? ' Limit has been enforced, ' + enforced + ' feeds have been removed.' : '';
        console.log('Bot Controller: Override limit reset for guild ID ${guildID}.' + enforceTxt + ' By (${message.author.id}, ${message.author.username})');
        'Override limit reset for guild ID ${guildID}.' + enforceTxt;
      } catch (e) {
        console.info(e);
      }
    }
  `).then(results => {
    for (var x in results) {
      if (results[x]) {
        bot.shard.broadcastEval(`
          const appDir = require('path').dirname(require.main.filename);
          delete require(appDir + '/util/storage.js').overriddenGuilds['${guildID}'];
        `).catch(err => console.log(`Bot Controller: Unable to eval update overriddenGuilds after eval removeoverride broadcast: `, err.message || err))
        return message.channel.send(results[x])
      }
    }
  }).catch(err => console.log(`Bot Controller: Unable to broadcast eval removeoverride. `, err.message || err))
}
