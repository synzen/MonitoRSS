const createLogger = require('../../util/logger/create.js')
const DebugFeed = require('../../structs/db/DebugFeed')

module.exports = async (message) => {
  const log = createLogger(message.guild.shard.id)
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const feedID = content[1]
  const debugFeed = new DebugFeed({
    feedId: feedID
  })
  await debugFeed.save()
  log.owner({
    user: message.author
  }, `Added ${feedID} to debugging list for all shards.`)
  await message.channel.send(`Added ${feedID} to debug`)
}
