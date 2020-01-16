const Profile = require('../structs/db/Profile.js')
const log = require('../util/logger.js')
const RedisGuild = require('../structs/db/Redis/Guild.js')

module.exports = async (oldGuild, newGuild) => {
  RedisGuild.utils.update(oldGuild, newGuild).catch(err => log.general.error(`Redis failed to update after guildUpdate event`, newGuild, err))
  try {
    const profile = await Profile.get(newGuild.id)
    if (profile && profile.name !== newGuild.name) {
      profile.name = newGuild.name
      await profile.save()
    }
  } catch (err) {
    log.general.warning(`Could not update guild after name change event`, newGuild, err)
  }
}
