const storage = require('../../util/storage.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const currentGuilds = storage.currentGuilds
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const sources = (currentGuilds.get(content[1]) && currentGuilds.get(content[1]).sources) ? currentGuilds.get(content[1]).sources : undefined

  const msg = sources ? `\`\`\`js\n${JSON.stringify(sources, null, 2)}\n\`\`\`` : ''
  try {
    if (msg.length < 2000) await message.channel.send(`\`\`\`js\n${JSON.stringify(sources, null, 2)}\n\`\`\``)
    else if (msg.length >= 2000) {
      await message.channel.send('Unable to send due to character length exceeding 2000. Logging to console instead.')
      log.controller.info(`Sources of guild ID ${content[1]}:\n${sources}`, message.author)
    } else await message.channel.send('No sources available.')
  } catch (err) {
    log.controller.warning('getsources', err)
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
      (currentGuilds.get("${guildID}") && currentGuilds.get("${guildID}").sources) ? currentGuilds.get("${guildID}").sources : undefined;
    `)
    for (var x in results) {
      if (!results[x]) continue

      const sources = results[x]
      const msg = `\`\`\`js\n${JSON.stringify(sources, null, 2)}\n\`\`\``

      if (msg.length < 2000) await message.channel.send(`\`\`\`js\n${JSON.stringify(sources, null, 2)}\n\`\`\``)
      else if (msg.length >= 2000) {
        await message.channel.send('Unable to send due to character length exceeding 2000. Logging to console instead.')
        log.controller.info(`Sources of guild ID ${content[1]}:\n${sources}`, message.author)
      } else await message.channel.send('No sources available.')
    }
  } catch (err) {
    log.controller.warning('getsources', err)
  }
}
