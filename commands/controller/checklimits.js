const storage = require('../../util/storage.js')
const config = require('../../config.json')
const currentGuilds = storage.currentGuilds

exports.normal = function (bot, message) {
  const overrides = storage.limitOverrides

  const illegals = []
  currentGuilds.forEach(function (guildRss, guildId) {
    const guildSourcesCnt = Object.keys(guildRss.sources).length
    const guildLimit = overrides[guildId] ? overrides[guildId] : config.feedSettings.maxFeeds
    if (guildSourcesCnt > guildLimit) illegals.push(guildId)
  })

  if (illegals.length === 0) message.channel.send(`Everything looks good!`)
  else message.channel.send(`Illegal sources found for the following guilds: \n\`\`\`${illegals}\`\`\``).catch(err => console.log(`Bot Controller: Illegal sources found, but could not send message of illegals. `, err.message || err, illegals))
}

exports.sharded = function (bot, message) {
  const defLimit = config.feedSettings.maxFeeds

  bot.shard.broadcastEval(`
    const appDir = require('path').dirname(require.main.filename);
    const storage = require(appDir + '/util/storage.js');
    const currentGuilds = storage.currentGuilds;
    const overrides = storage.limitOverrides;

    const illegals = [];
    currentGuilds.forEach(function (guildRss, guildId) {
      const guildSourcesCnt = Object.keys(guildRss.sources).length;
      const guildLimit = overrides[guildId] ? overrides[guildId] : ${defLimit};
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
