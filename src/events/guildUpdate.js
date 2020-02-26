const Profile = require('../structs/db/Profile.js')
const RedisGuild = require('../structs/db/Redis/Guild.js')
const createLogger = require('../util/logger/create.js')

module.exports = async (oldGuild, newGuild) => {
  RedisGuild.utils.update(oldGuild, newGuild)
    .catch(err => {
      const log = createLogger(oldGuild.shard.id)
      log.error(err, `Redis failed to update after guildUpdate event`)
    })
  try {
    const profile = await Profile.get(newGuild.id)
    if (profile && profile.name !== newGuild.name) {
      profile.name = newGuild.name
      await profile.save()
    }
  } catch (err) {
    const log = createLogger(oldGuild.shard.id)
    log.warn(err, `Could not update guild after name change event`)
  }
}
