const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')
const storage = require('../util/storage.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

module.exports = async role => {
  if (storage.redisClient && role.hasPermission(MANAGE_CHANNELS_PERM)) {
    role.members.forEach((member, userId) => {
      storage.redisClient.srem(storage.redisKeys.guildManagers(role.guild.id), userId, err => err ? console.log(err) : null)
    })
  }

  try {
    const guildRss = await dbOps.guildRss.get(role.guild.id)

    if (!guildRss || !guildRss.sources || !Object.keys(guildRss.sources).length === 0) return
    const rssList = guildRss.sources
    let edited = false

    // Delete from global role subscriptions if exists
    for (var rssName in rssList) {
      const source = rssList[rssName]
      const subKeys = ['globalSubscriptions', 'filteredSubscriptions']
      for (const key of subKeys) {
        const subscriptions = source[key]
        if (subscriptions) {
          for (let i = subscriptions.length - 1; i >= 0; --i) {
            const subscriber = subscriptions[i]
            if (subscriber.id !== role.id) continue
            edited = true
            subscriptions.splice(i, 1)
          }
        }
      }
      if (source.globalSubscriptions && source.globalSubscriptions.length === 0) {
        edited = true
        delete source.globalSubscriptions
      }
      if (source.filteredSubscriptions && source.filteredSubscriptions === 0) {
        edited = true
        delete source.filteredSubscriptions
      }
    }

    if (!edited) return
    await dbOps.guildRss.update(guildRss)
    log.guild.info(`Role has been removed from config by guild role deletion`, role.guild, role)
  } catch (err) {
    log.guild.warning(`Role could not be removed from config by guild role deletion`, role.guild, role, err)
  }
}
