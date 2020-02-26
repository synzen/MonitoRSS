const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const feedID = content[1]
  await message.client.shard.broadcastEval(`
    const fs = require('fs');
    const path = require('path');
    const appDir = path.dirname(require.main.filename);
    const debug = require(appDir + '/src/util/debugFeeds.js');
    debug.feeds.remove('${feedID}');
  `)
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author
  }, `Removed ${feedID} from debug`)
  await message.channel.send(`Removed ${feedID} from debug`)
}
