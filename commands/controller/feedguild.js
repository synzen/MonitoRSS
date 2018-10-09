const storage = require('../../util/storage.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const currentGuilds = storage.currentGuilds
  const content = message.content.split(' ')
  if (content.length !== 2) return
  let found = false

  currentGuilds.forEach((guildRss, guildId) => {
    if (found) return
    const rssList = guildRss.sources
    for (var rssName in rssList) {
      if (rssName === content[1]) {
        found = true
        return
      }
    }
  })
  try {
    if (!found) await message.channel.send(`Could not find any feeds with that rssName.`)
    else await message.channel.send(`Found guild.`)
  } catch (err) {
    log.controller.warning('feedguild', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('checklimits 1a', message.guild, err))
  }
}

exports.sharded = async (bot, message, Manager) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const rssName = content[1]
  try {
    const results = await bot.shard.broadcastEval(`
      const appDir = require('path').dirname(require.main.filename);
      const currentGuilds = require(appDir + '/util/storage.js').currentGuilds;
      let found = false;

      currentGuilds.forEach((guildRss, guildId) => {
        if (found) return;
        const rssList = guildRss.sources;
        for (var rssName in rssList) {
          if (rssName === '${rssName}') return found = guildId;
        }
      });

      found;
    `)
    for (var x in results) {
      if (results[x]) return await message.channel.send(`Found guild ID ${results[x]}`)
    }
    await message.channel.send('Could not find any guilds with feeds identified by that rssName.')
  } catch (err) {
    log.controller.warning('feedguild', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('feedguild 1b', message.guild, err))
  }
}
