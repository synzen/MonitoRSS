const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  const username = content.join(' ')
  const original = message.client.user.username
  const u = await message.client.user.setUsername(username)
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author
  }, `Bot usename changed from ${original} to ${u.username}`)
  await message.channel.send(`Bot username has been changed from ${original} to ${u.username}.`)
}
