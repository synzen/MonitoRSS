const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const log = createLogger(message.guild.shard.id)
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const feedID = content[1]
  await message.client.shard.broadcastEval(`
    const fs = require('fs');
    const path = require('path');
    const appDir = path.dirname(require.main.filename);
    const storage = require(appDir + '/src/util/storage.js');
    const debug = require(appDir + '/src/util/debugFeeds.js');

    debug.feeds.add('${feedID}')
    'done'
  `)
  log.owner({
    user: message.author
  }, `Added ${feedID} to debugging list for all shards.`)
  await message.channel.send(`Added ${feedID} to debug`)
}
