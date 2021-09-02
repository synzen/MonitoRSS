const createLogger = require('../../util/logger/create.js')
const DebugFeed = require('../../structs/db/DebugFeed')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const feedID = content[1]
  const found = await DebugFeed.getByQuery({
    feedId: feedID
  })
  if (found) {
    await found.delete()
  }
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author
  }, `Removed ${feedID} from debug`)
  await message.channel.send(`Removed ${feedID} from debug`)
}
