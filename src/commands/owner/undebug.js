const debug = require('../../util/debugFeeds.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const rssName = content[1]
  try {
    if (!debug.feeds.has(rssName)) {
      return await message.channel.send(`Cannot remove, ${rssName} is not in debugging list.`)
    }
    debug.feeds.remove(rssName)
    return await message.channel.send(`Removed ${rssName} from debugging list.`)
  } catch (err) {
    log.owner.warning('debug', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('undebug 1', message.guild, err))
  }
}

exports.sharded = (bot, message, Manager) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const rssName = content[1]
  bot.shard.broadcastEval(`
    const fs = require('fs');
    const path = require('path');
    const appDir = path.dirname(require.main.filename);
    const log = require(appDir + '/src/util/logger.js');
    const debug = require(appDir + '/src/util/debugFeeds.js');
    debug.feeds.remove('${rssName}');
  `).catch(err => {
    log.owner.warning(`Unable to broadcast undebug eval`, message.author, err)
  })
}
