const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  try {
    if (content.length !== 2) return await message.channel.send('You must specify the guild ID as the first argument.')
    const guild = bot.guilds.get(content[1])
    if (!guild) return await message.channel.send('No such guild found.')
    await guild.leave()
    log.owner.success(`Guild ${content[1]} (${guild.name}) has been removed`, message.author)
    return await message.channel.send(`Guild ${content[1]} (${guild.name}) removed.`)
  } catch (err) {
    log.owner.warning('leaveguild', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('leaveguild 1a', message.guild, err))
  }
}

exports.sharded = async (bot, message) => {
  const content = message.content.split(' ')
  try {
    if (content.length !== 2) return await message.channel.send('You must specify the guild ID as the first argument.')
    const results = await bot.shard.broadcastEval(`
    const guild = this.guilds.get('${content[1]}')
    const obj = {}
    if (guild) {
      guild.leave().catch(console.log)
      obj.name = guild.name
      obj.id = guild.id
      obj
    }
    `)
    const removed = results.filter(kicked => kicked)
    if (removed.length === 0) return await message.channel.send('No such guild found.')
    log.owner.success(`Guild ${content[1]} (${removed[0].name}) has been removed`, message.author)
    return await message.channel.send(`Guild ${content[1]} (${removed[0].name}) was found - see console for whether the removal was successful.`)
  } catch (err) {
    log.owner.warning('leaveguild', message.author, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('leaveguild 1b', message.guild, err))
  }
}
