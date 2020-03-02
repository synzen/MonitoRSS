const ipc = require('../../util/ipc.js')
const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const feedID = content[1]
  ipc.send(ipc.TYPES.REMOVE_DEBUG_FEEDID, feedID)
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author
  }, `Removed ${feedID} from debug`)
  await message.channel.send(`Removed ${feedID} from debug`)
}
