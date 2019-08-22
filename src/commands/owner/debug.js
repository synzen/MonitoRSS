const debug = require('../../util/debugFeeds.js')
const dbOpsGuilds = require('../../util/db/guilds.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const debugFeeds = debug.list
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const rssName = content[1]

  let found = false
  try {
    const guildRssList = await dbOpsGuilds.getAll()
    guildRssList.forEach(guildRss => {
      if (found) return
      const rssList = guildRss.sources
      for (var name in rssList) {
        if (rssName === name) {
          found = true
          if (!debugFeeds.includes(rssName)) debugFeeds.push(rssName)
          log.owner.success(`Added ${rssName} to debugging list.`)
        }
      }
    })
    if (!found) log.owner.warning(`Unable to add ${rssName} to debugging list, not found in any guild sources.`)
    else return true
  } catch (err) {
    log.owner.warning('debug', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('debug 1', message.guild, err))
  }
}

exports.sharded = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  try {
    const found = await exports.normal(bot, message)
    if (!found) return
    const rssName = content[1]
    await bot.shard.broadcastEval(`
      const fs = require('fs');
      const path = require('path');
      const appDir = path.dirname(require.main.filename);
      const storage = require(appDir + '/src/util/storage.js');
      const log = require(appDir + '/src/util/logger.js');
      const debugFeeds = require(appDir + '/src/util/debugFeeds.js').list;

      debugFeeds.push('${rssName}')
      'done'
    `)
    log.owner.success(`Shard ${bot.shard.id} added ${rssName} to debugging list.`)
  } catch (err) {
    log.owner.warning('debug', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('debug 1', message.guild, err))
  }
}
