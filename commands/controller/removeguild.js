const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  try {
    if (content.length !== 2) return await message.channel.send('You must specify the guild ID as the first argument.')
    const guild = bot.guilds.get(content[1])
    if (!guild) return await message.channel.send('No such guild found.')
    await guild.leave()
    log.controller.success(`Guild ${content[1]} (${guild.name}) has been removed`, message.author)
    return await message.channel.send('Guild removed.')
  } catch (err) {
    log.controller.warning('leaveguild', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('leaveguild 1a', message.guild, err))
  }
}

exports.sharded = exports.normal
