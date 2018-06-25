const debug = require('../../util/debugFeeds.js')
const storage = require('../../util/storage.js')
const log = require('../../util/logger.js')

exports.normal = (bot, message) => {
  const currentGuilds = storage.currentGuilds
  const debugFeeds = debug.list
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const rssName = content[1]

  let found = false
  currentGuilds.forEach((guildRss, guildId) => {
    if (found) return
    const rssList = guildRss.sources
    for (var name in rssList) {
      if (rssName === name) {
        found = true
        debugFeeds.push(rssName)
        log.controller.success(`Added ${rssName} to debugging list.`)
      }
    }
  })
  if (!found) log.controller.warning(`Unable to add ${rssName} to debugging list, not found in any guild sources.`)
}

exports.sharded = (bot, message, Manager) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const rssName = content[1]
  bot.shard.broadcastEval(`
    const fs = require('fs');
    const path = require('path');
    const appDir = path.dirname(require.main.filename);
    const storage = require(appDir + '/util/storage.js');
    const log = require(appDir + '/util/logger.js');
    const currentGuilds = storage.currentGuilds;
    const debugFeeds = require(appDir + '/util/debugFeeds.js').list;

    let found = false;
    currentGuilds.forEach((guildRss, guildId) => {
      if (found) return;
      const rssList = guildRss.sources;
      for (var name in rssList) {
        if ('${rssName}' === name) {
          found = true;
          debugFeeds.push('${rssName}');
          log.controller.success('Added ${rssName} to debugging list.');
          'Done';
        }
      }
    });
  `).catch(err => log.controller.warning(`Unable to broadcast eval debug. `, err.message || err))
}
