const debugFeeds = require('../../util/debugFeeds.js').list

exports.normal = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const rssName = content[1]

  if (!debugFeeds.includes(rssName)) return console.log(`Cannot remove, ${rssName} is not in debugging list.`)
  for (var index in debugFeeds) {
    if (debugFeeds[index] === rssName) {
      debugFeeds.splice(index, 1)
      return console.log(`Removed ${rssName} from debugging list.`)
    }
  }
}

exports.sharded = function (bot, message, Manager) {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const rssName = content[1]
  bot.shard.broadcastEval(`
    const fs = require('fs');
    const path = require('path');
    const appDir = path.dirname(require.main.filename);
    const debugFeeds = require(appDir + '/util/debugFeeds.js').list;

    if (debugFeeds.includes('${rssName}')) {
      for (var index in debugFeeds) {
        if (debugFeeds[index] === '${rssName}') {
          debugFeeds.splice(index, 1);
          console.log('Removed ${rssName} from debugging list.');
        }
      }
    }
  `).catch(err => {
    console.log(`Bot Controller: Unable to broadcast undebug eval, reason: `, err.message || err)
  })
}
