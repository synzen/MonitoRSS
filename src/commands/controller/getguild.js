const log = require('../../util/logger.js')
const dbOps = require('../../util/dbOps.js')

exports.normal = async (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  try {
    const guildRss = await dbOps.guildRss.get(content[1])
    if (!guildRss) await message.channel.send('No profile available for guild.')
    const msg = guildRss ? `\`\`\`js\n${JSON.stringify(guildRss, null, 2)}\n\`\`\`` : ''

    if (msg.length < 2000) await message.channel.send(`\`\`\`js\n${JSON.stringify(guildRss, null, 2)}\n\`\`\``)
    else if (msg.length >= 2000) {
      await message.channel.send('Unable to send due to character length exceeding 2000. Logging to console instead.')
      log.controller.info(`Guild ID ${content[1]} data:`, message.author)
      console.log(guildRss)
    } else await message.channel.send('No data available.')
  } catch (err) {
    log.controller.warning('getguild', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('getguild 1a', message.guild, err))
  }
}

exports.sharded = exports.normal
