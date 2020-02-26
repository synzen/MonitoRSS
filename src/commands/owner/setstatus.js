const createLogger = require('../../util/logger/create.js')
const VALID_STATUS = ['online', 'idle', 'invisible', 'dnd']

function getStatus (message) {
  const content = message.content.split(' ')
  if (content.length === 1) return undefined
  content.shift()
  return content.join(' ').trim()
}

module.exports = async (message) => {
  const status = getStatus(message)
  if (!VALID_STATUS.includes(status)) {
    return message.channel.send(`That is not a valid status (\`${status}\`). Must be one of the following: \`${VALID_STATUS.join('`, `')}\`. `)
  }
  await message.client.user.setStatus(status)
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author
  }, `Changed bot status to ${status}`)
  await message.channel.send(`Successfully changed the status to \`${status}\`.`)
}
