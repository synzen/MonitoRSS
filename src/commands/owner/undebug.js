const log = require('../../util/logger.js')

module.exports = (bot, message, Manager) => {
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
