const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  await message.client.user.setAvatar(content[0])
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author
  }, `Changed avatar to ${content[0]}`)
  await message.channel.send('Successfully changed avatar.')
}
