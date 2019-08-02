const debug = require('../../util/debugFeeds.js')
const dbOps = require('../../util/dbOps.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const debugFeeds = debug.list
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const rssName = content[1]

  let found = false
  try {
    const guildRssList = await dbOps.guildRss.getAll()
    guildRssList.forEach(guildRss => {
      if (found) return
      const rssList = guildRss.sources
      for (var name in rssList) {
        if (rssName === name) {
          found = true
          if (!debugFeeds.includes(rssName)) debugFeeds.push(rssName)
          log.controller.success(`Added ${rssName} to debugging list.`)
        }
      }
    })
    if (!found) log.controller.warning(`Unable to add ${rssName} to debugging list, not found in any guild sources.`)
    else return true
  } catch (err) {
    log.controller.warning('debug', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('debug 1', message.guild, err))
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
      const storage = require(appDir + '/util/storage.js');
      const log = require(appDir + '/util/logger.js');
      const debugFeeds = require(appDir + '/util/debugFeeds.js').list;

      debugFeeds.push('${rssName}')
      'done'
    `)
    log.controller.success(`Added ${rssName} to debugging list.`)
  } catch (err) {
    log.controller.warning('debug', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('debug 1', message.guild, err))
  }
}
