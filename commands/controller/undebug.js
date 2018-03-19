const debugFeeds = require('../../util/debugFeeds.js').list
const log = require('../../util/logger.js')

exports.normal = (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const rssName = content[1]

  if (!debugFeeds.includes(rssName)) return log.controller.info(`Cannot remove, ${rssName} is not in debugging list.`)
  for (var index in debugFeeds) {
    if (debugFeeds[index] === rssName) {
      debugFeeds.splice(index, 1)
      return log.controller.info(`Removed ${rssName} from debugging list.`)
    }
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
    const log = require(appDir + '/util/logger.js');
    const debugFeeds = require(appDir + '/util/debugFeeds.js').list;

    if (debugFeeds.includes('${rssName}')) {
      for (var index in debugFeeds) {
        if (debugFeeds[index] === '${rssName}') {
          debugFeeds.splice(index, 1);
          log.controller.info('Removed ${rssName} from debugging list');
        }
      }
    }
  `).catch(err => {
    log.controller.warning(`Unable to broadcast undebug eval`, message.author, err)
  })
}
