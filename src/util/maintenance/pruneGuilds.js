const GuildProfile = require('../../structs/db/GuildProfile.js')

/**
 * Remove all guilds no longer with the bot
 * @param {Set<string>} guildIds
 * @returns {number}
 */
async function pruneGuilds (guildIds) {
  const profiles = await GuildProfile.getAll()
  const deletions = []
  for (const profile of profiles) {
    if (!guildIds.has(profile._id)) {
      deletions.push(profile.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneGuilds
