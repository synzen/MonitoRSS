const storage = require('../../util/storage.js')
const config = require('../../config.json')
const log = require('../../util/logger.js')
const currentGuilds = storage.currentGuilds

exports.normal = async (bot, message) => {
  const overrides = storage.limitOverrides
  try {
    const illegals = []
    currentGuilds.forEach((guildRss, guildId) => {
      const guildSourcesCnt = Object.keys(guildRss.sources).length
      const guildLimit = overrides[guildId] ? overrides[guildId] : config.feeds.max
      if (guildSourcesCnt > guildLimit) illegals.push(guildId)
    })

    if (illegals.length === 0) await message.channel.send(`Everything looks good!`)
    else await message.channel.send(`Illegal sources found for the following guilds: \n\`\`\`${illegals}\`\`\``)
  } catch (err) {
    log.controller.warning('checklimits', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('checklimits 1a', message.guild, err))
  }
}

exports.sharded = async (bot, message) => {
  const defLimit = config.feeds.max
  try {
    const results = await bot.shard.broadcastEval(`
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
    `)
    let illegals = []
    for (var x in results) if (results[x]) illegals = illegals.concat(results[x])
    if (illegals.length === 0) await message.channel.send(`Everything looks good!`)
    else await message.channel.send(`Illegal sources found for the following guilds: \n\`\`\`${illegals}\`\`\``)
  } catch (err) {
    log.controller.warning('checklimits', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('checklimits 1b', message.guild, err))
  }
}
