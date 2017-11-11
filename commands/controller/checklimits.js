const storage = require('../../util/storage.js')
const config = require('../../config.json')

exports.normal = function (bot, message) {
  const currentGuilds = storage.currentGuilds
  const overriddenGuilds = storage.overriddenGuilds

  const illegals = []
  currentGuilds.forEach(function (guildRss, guildId) {
    const guildSourcesCnt = guildRss.sources.size()
    const guildLimit = overriddenGuilds[guildId] ? overriddenGuilds[guildId] : config.feedSettings.maxFeeds
    if (guildSourcesCnt > guildLimit) illegals.push(guildId)
  })

  if (illegals.length === 0) message.channel.send(`Everything looks good!`)
  else message.channel.send(`Illegal sources found for the following guilds: \n\`\`\`${illegals}\`\`\``).catch(err => console.log(`Bot Controller: Illegal sources found, but could not send message of illegals. `, err.message || err, illegals))
}

exports.sharded = function (bot, message) {
  const overriddenGuilds = storage.overriddenGuilds
  const defLimit = config.feedSettings.maxFeeds

  bot.shard.broadcastEval(`
    const appDir = require('path').dirname(require.main.filename);
    const storage = require(appDir + '/util/storage.js');
    const currentGuilds = storage.currentGuilds;
    const overriddenGuilds = JSON.parse('${JSON.stringify(overriddenGuilds)}');

    const illegals = [];
    currentGuilds.forEach(function (guildRss, guildId) {
      const guildSourcesCnt = guildRss.sources.size();
      const guildLimit = overriddenGuilds[guildId] ? overriddenGuilds[guildId] : ${defLimit};
      if (guildSourcesCnt > guildLimit) illegals.push(guildId);
    })

    if (illegals.length > 0) illegals;
  `).then(results => {
    let illegals = []
    for (var x in results) if (results[x]) illegals = illegals.concat(results[x])

    if (illegals.length === 0) message.channel.send(`Everything looks good!`)
    else message.channel.send(`Illegal sources found for the following guilds: \n\`\`\`${illegals}\`\`\``).catch(err => console.log(`Bot Controller: Illegal sources found, but could not send message of illegals. `, err.message || err, illegals))
  }).catch(err => console.log(`Bot Controller: Unable to broadcast eval checklimits. `, err.message || err))
}
