const Profile = require('../structs/db/Profile.js')
const log = require('../util/logger.js')
// https://discordapp.com/developers/docs/topics/opcodes-and-status-codes
const DELETE_CODES = new Set([10007, 10013, 50035])

/**
 * @param {import('discord.js').Client} bot
 * @returns {number}
 */
async function pruneProfileAlerts (bot) {
  /** @type {Profile[]} */
  const profiles = await Profile.getAll()
  const promises = profiles.map(profile => (async () => {
    let updated = false
    const guildID = profile._id
    const guild = bot.guilds.cache.get(guildID)
    if (!guild) {
      return
    }
    const userAlerts = profile.alert
    for (let i = userAlerts.length - 1; i >= 0; --i) {
      const memberID = userAlerts[i]
      if (!(/^\d+$/.test(memberID))) {
        // Has non-digits
        log.general.info(`Deleting invalid alert user "${memberID}"`, guild)
        userAlerts.splice(i, 1)
        updated = true
        continue
      }
      try {
        await guild.members.fetch(memberID)
      } catch (err) {
        // Either unknown member, user, or invalid ID
        if (DELETE_CODES.has(err.code)) {
          log.general.info(`Deleting missing alert user "${memberID}"`, guild)
          userAlerts.splice(i, 1)
          updated = true
        } else {
          throw err
        }
      }
    }
    if (updated) {
      await profile.save()
    }
  })())

  await Promise.all(promises)
}

module.exports = pruneProfileAlerts
