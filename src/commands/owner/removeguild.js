const createLogger = require('../../util/logger/create.js')

module.exports = async (message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) {
    return message.channel.send('You must specify the guild ID as the first argument.')
  }
  const results = await message.client.shard.broadcastEval(`
  const guild = this.guilds.cache.get('${content[1]}')
  const obj = {}
  if (guild) {
    guild.leave().catch(console.log)
    obj.name = guild.name
    obj.id = guild.id
    obj
  }
  `)
  const removed = results.filter(kicked => kicked)
  if (removed.length === 0) {
    return message.channel.send('No such guild found.')
  }
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author
  }, `Guild ${content[1]} (${removed[0].name}) has been removed`)
  return message.channel.send(`Guild ${content[1]} (${removed[0].name}) was found - see console for whether the removal was successful.`)
}
