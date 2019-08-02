const storage = require('../../../util/storage.js')
const currentGuilds = storage.currentGuilds

module.exports = async (bot, link) => {
  if (bot.shard && bot.shard.count > 0) {
    const results = await bot.shard.broadcastEval(`
            const appDir = require('path').dirname(require.main.filename);
            const currentGuilds = require(appDir + '/util/storage.js').currentGuilds;
            const affected = {} 
            
            currentGuilds.forEach(guildRss => {
                const rssList = guildRss.sources
                if (!rssList) return
                for (var rssName in rssList) {
                    const source = rssList[rssName]
                    if (source.link !== '${link}') continue
                    if (!affected[guildRss.id]) affected[guildRss.id] = { guildRss: guildRss, rssNames: [rssName] }
                    else affected[guildRss.id].rssNames.push(rssName)
                }
            })
            Object.keys(affected).length === 0 ? null : affected
        `)
    return results.filter((item, index, self) => item && index === self.indexOf(item))
  } else {
    const affected = {} // keys are guild ids, value is another object with key guildRss and rssNames

    currentGuilds.forEach(guildRss => {
      const rssList = guildRss.sources
      if (!rssList) return
      for (var rssName in rssList) {
        const source = rssList[rssName]
        if (source.link !== `${link}`) continue
        if (!affected[guildRss.id]) affected[guildRss.id] = { guildRss: guildRss, rssNames: [rssName] }
        else affected[guildRss.id].rssNames.push(rssName)
      }
    })
    return Object.keys(affected).length === 0 ? [] : [affected]
  }
}
