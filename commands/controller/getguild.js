const storage = require('../../util/storage.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const currentGuilds = storage.currentGuilds
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const guildData = currentGuilds.get(content[1])

  const msg = guildData ? `\`\`\`js\n${JSON.stringify(guildData, null, 2)}\n\`\`\`` : ''
  try {
    if (msg.length < 2000) await message.channel.send(`\`\`\`js\n${JSON.stringify(guildData, null, 2)}\n\`\`\``)
    else if (msg.length >= 2000) {
      await message.channel.send('Unable to send due to character length exceeding 2000. Logging to console instead.')
      log.controller.info(`Guild ID ${content[1]} data:`, message.author)
      console.log(guildData)
    } else await message.channel.send('No data available.')
  } catch (err) {
    log.controller.warning('getguild', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('getguild 1a', message.guild, err))
  }
}

exports.sharded = async (bot, message, Manager) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const guildID = content[1]
  try {
    const results = await bot.shard.broadcastEval(`
      const path = require('path');
      const appDir = path.dirname(require.main.filename);
      const storage = require(appDir + '/util/storage.js');
      const currentGuilds = storage.currentGuilds;
      (currentGuilds.get("${guildID}") && currentGuilds.get("${guildID}").sources) ? currentGuilds.get("${guildID}") : undefined;
    `)
    for (var x in results) {
      if (!results[x]) continue

      const guildData = results[x]
      const msg = `\`\`\`js\n${JSON.stringify(guildData, null, 2)}\n\`\`\``

      if (msg.length < 2000) await message.channel.send(`\`\`\`js\n${JSON.stringify(guildData, null, 2)}\n\`\`\``)
      else if (msg.length >= 2000) {
        await message.channel.send('Unable to send due to character length exceeding 2000. Logging to console instead.')
        log.controller.info(`Guild ID ${content[1]} data:`, message.author)
        console.log(guildData)
      } else await message.channel.send('No sources available.')
    }
  } catch (err) {
    log.controller.warning('getguild', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('getguild 1b', message.guild, err))
  }
}
