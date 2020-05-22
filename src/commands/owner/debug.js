const ipc = require('../../util/ipc.js')
const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const log = createLogger(message.guild.shard.id)
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const feedID = content[1]
  ipc.send(ipc.TYPES.ADD_DEBUG_FEEDID, feedID)
  log.owner({
    user: message.author
  }, `Added ${feedID} to debugging list for all shards.`)
  await message.channel.send(`Added ${feedID} to debug`)
}
