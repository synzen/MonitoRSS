const log = require('../../util/logger.js')

module.exports = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  try {
    const found = await exports.normal(bot, message)
    if (found) return
    const rssName = content[1]
    await bot.shard.broadcastEval(`
      const fs = require('fs');
      const path = require('path');
      const appDir = path.dirname(require.main.filename);
      const storage = require(appDir + '/src/util/storage.js');
      const log = require(appDir + '/src/util/logger.js');
      const debug = require(appDir + '/src/util/debugFeeds.js');

      debug.feeds.add('${rssName}')
      'done'
    `)
    log.owner.success(`Shard ${bot.shard.id} added ${rssName} to debugging list.`)
  } catch (err) {
    log.owner.warning('debug', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('debug 1', message.guild, err))
  }
}
