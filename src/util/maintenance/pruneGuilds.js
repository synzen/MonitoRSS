const Profile = require('../../structs/db/Profile.js')

/**
 * Remove all guilds no longer with the bot
 * @param {Map<string, number>} guildIdsByShard
 * @returns {number}
 */
async function pruneGuilds (guildIdsByShard) {
  const profiles = await Profile.getAll()
  const deletions = []
  for (const profile of profiles) {
    if (!guildIdsByShard.has(profile._id)) {
      deletions.push(profile.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneGuilds
