const checkGuild = require('../util/checkGuild.js')
const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')
const storage = require('../util/storage.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

module.exports = (oldRole, newRole) => {
  const guildId = newRole.guild.id
  if (storage.redisClient) {
    const oldRoleHas = oldRole.hasPermission(MANAGE_CHANNELS_PERM)
    const newRoleHas = newRole.hasPermission(MANAGE_CHANNELS_PERM)
    if (oldRoleHas !== newRoleHas) {
      const newRoleMembers = newRole.members
      if (!newRoleHas) {
        newRoleMembers.forEach((member, userId) => {
          storage.redisClient.srem(storage.redisKeys.guildManagers(guildId), userId, err => err ? console.log(err) : null)
        })
      } else {
        newRoleMembers.forEach((member, userId) => {
          storage.redisClient.sadd(storage.redisKeys.guildManagers(guildId), userId, err => err ? console.log(err) : null)
        })
      }
    }
  }

  if (oldRole.name === newRole.name) return
  dbOps.guildRss.get(oldRole.guild.id).then(guildRss => {
    if (!guildRss) return
    checkGuild.subscriptions(newRole.client, guildRss)
  }).catch(err => log.general.warning('Unable get guild profile after role update', oldRole.guild, err))
}
