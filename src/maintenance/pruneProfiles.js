const Profile = require('../structs/db/Profile.js')

/**
 * Remove all guilds no longer with the bot
 * @param {Map<string, number>} guildIdsByShard
 * @returns {number}
 */
async function pruneProfiles (guildIdsByShard) {
  const profiles = await Profile.getAll()
  const deletions = []
  const length = profiles.length
  for (var i = 0; i < length; ++i) {
    const profile = profiles[i]
    if (!guildIdsByShard.has(profile._id)) {
      deletions.push(profile.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneProfiles
