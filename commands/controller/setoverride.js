const fs = require('fs')
const storage = require('../../util/storage.js')
const config = require('../../config.json')
const removeRss = require('../../util/removeRss.js')

exports.normal = function (bot, message) {
  const currentGuilds = storage.currentGuilds
  const overriddenGuilds = storage.overriddenGuilds

  const content = message.content.split(' ')
  if (content.length < 3 || content.length > 4) return message.channel.send(`The proper syntax to override a server's feed limit is \`${config.botSettings.prefix}setoverride <guildID> <#>\`.`)
  const guildID = content[1]
  if (!currentGuilds.has(guildID) || !bot.guilds.has(guildID)) return message.channel.send(`Unable to set limit, guild ID \`${guildID}\` was either not found in guild list or has no active feeds.`)

  let newLimit = parseInt(content[2], 10)

  if (isNaN(newLimit) || newLimit % 1 !== 0) return message.channel.send(`That is not a valid number.`)
  if (newLimit === config.feedSettings.maxFeeds) return message.channel.send(`That is already the default limit.`)

  overriddenGuilds[guildID] = newLimit
  try {
    fs.writeFileSync('./settings/limitOverrides.json', JSON.stringify(overriddenGuilds, null, 2))
    let enforced

    if (content[3] === 'enforce') {
      enforced = 0
      let guildRss = currentGuilds.get(guildID)
      let rssList = guildRss.sources
      if (rssList.size() > newLimit) {
        for (var rssName in rssList) {
          if (rssList.size() > newLimit) {
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

    const enforceTxt = enforced ? ` Limit has been enforced, ${enforced} feed(s) have been removed.` : ''
    message.channel.send(`Override limit set to ${newLimit} for guild ID ${guildID}.${enforceTxt}`)
    console.log(`Bot Controller: Override limit set to ${newLimit} for guild ID ${guildID}.${enforceTxt} by (${message.author.id}, ${message.author.username}).`)
    return true
  } catch (e) {
    console.log(`Bot Controller: Unable to write to file limitOverrides for command setoverride: `, e.message || e)
    message.channel.send(`Unable to write to file limitOverrides for command setoverride.`, e.message || e)
  }
}

exports.sharded = function (bot, message, Manager) {
  const content = message.content.split(' ')
  if (content.length < 3 || content.length > 4) return message.channel.send(`The proper syntax to override a server's feed limit is \`${config.botSettings.prefix}setoverride <guildID> <#>\`.`)
  const guildID = content[1]
  const newLimit = parseInt(content[2], 10)
  const enforce = content[3]

  if (bot.guilds.has(guildID)) {
    if (exports.normal(bot, message)) {
      bot.shard.broadcastEval(`
        require(require('path').dirname(require.main.filename) + '/util/storage.js').overriddenGuilds['${guildID}'] = ${newLimit};
      `).catch(err => console.log(`Bot Controller: Unable to eval update overriddenGuilds after normal setoverride: `, err.message || err))
    }
    return
  }

  if (isNaN(newLimit) || newLimit % 1 !== 0) return message.channel.send('That is not a valid number.')
  if (newLimit === config.feedSettings.maxFeeds) return message.channel.send(`That is already the default limit.`)

  bot.shard.broadcastEval(`
    const fs = require('fs');
    const appDir = require('path').dirname(require.main.filename);
    const storage = require(appDir + '/util/storage.js');
    const currentGuilds = storage.currentGuilds;
    const overriddenGuilds = storage.overriddenGuilds;
    const removeRss = require(appDir + '/util/removeRss.js');


    if (currentGuilds.has('${guildID}') && this.guilds.has('${guildID}')) {

      const newLimit = ${newLimit};
      overriddenGuilds['${guildID}'] = newLimit;

      try {
        fs.writeFileSync('./settings/limitOverrides.json', JSON.stringify(overriddenGuilds, null, 2));
        let enforced;

        if ('${enforce}' === 'enforce') {
          enforced = 0;
          let guildRss = currentGuilds.get('${guildID}');
          let rssList = guildRss.sources;
          if (rssList.size() > newLimit) {
            for (var rssName in rssList) {
              if (rssList.size() > newLimit) {
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
        const enforcedTxt = enforced ? ' Limit has been enforced, ' + enforced + ' feed(s) have been removed.' : '';
        console.log('Bot Controller: Override limit set to ${newLimit} for guild ID ${guildID}' + enforcedTxt + ' by (${message.author.id}, ${message.author.username}).');
        'Override limit set to ${newLimit} for guild ID ${guildID}.' + enforcedTxt;
      } catch (e) {
        console.info(e);
      }
    }
  `).then(results => {
    for (var x in results) {
      if (results[x]) {
        bot.shard.broadcastEval(`
          let appDir = ;
          require(require('path').dirname(require.main.filename) + '/util/storage.js').overriddenGuilds['${guildID}'] = ${newLimit};
        `).catch(err => console.log(`Bot Controller: Unable to eval update overriddenGuilds after eval setoverride broadcast: `, err.message || err))

        return message.channel.send(results[x])
      }
    }
    message.channel.send(`Unable to set limit, guild ID \`${guildID}\` was either not found in any guild lists or has no active feeds.`)
  }).catch(err => console.log(`Bot Controller: Unable to broadcast eval setoverride. `, err.message || err))
}
