const storage = require('../../util/storage.js')

exports.normal = function (bot, message) {
  const currentGuilds = storage.currentGuilds
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const sources = (currentGuilds.get(content[1]) && currentGuilds.get(content[1]).sources) ? currentGuilds.get(content[1]).sources : undefined

  const msg = sources ? `\`\`\`js\n${JSON.stringify(sources, null, 2)}\n\`\`\`` : ''

  if (msg.length < 2000) message.channel.send(`\`\`\`js\n${JSON.stringify(sources, null, 2)}\n\`\`\``)
  else if (msg.length >= 2000) {
    message.channel.send('Unable to send due to character length exceeding 2000. Logging to console instead.')
    console.info(`Bot Controller: Sources of guild ID ${content[1]} requested by (${message.author.id}, ${message.author.username}):\n`, sources)
  } else message.channel.send('No sources available.')
}

exports.sharded = function (bot, message, Manager) {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const guildID = content[1]

  bot.shard.broadcastEval(`
    const path = require('path');
    const appDir = path.dirname(require.main.filename);
    const storage = require(appDir + '/util/storage.js');
    const currentGuilds = storage.currentGuilds;
    (currentGuilds.get("${guildID}") && currentGuilds.get("${guildID}").sources) ? currentGuilds.get("${guildID}").sources : undefined;
  `).then(results => {
    for (var x in results) {
      if (!results[x]) continue

      const sources = results[x]
      const msg = `\`\`\`js\n${JSON.stringify(sources, null, 2)}\n\`\`\``

      if (msg.length < 2000) message.channel.send(`\`\`\`js\n${JSON.stringify(sources, null, 2)}\n\`\`\``)
      else if (msg.length >= 2000) {
        message.channel.send('Unable to send due to character length exceeding 2000. Logging to console instead.')
        console.info(`Bot Controller: Sources of guild ID ${content[1]} requested by (${message.author.id}, ${message.author.username}):\n`, sources)
      } else message.channel.send('No sources available.')
    }
  }).catch(err => console.log(`Bot Controller: Unable to broadcast eval getsources, reason:\n`, err))
}
