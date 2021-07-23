const Profile = require('../structs/db/Profile.js')
const createLogger = require('../util/logger/create.js')
// https://discord.com/developers/docs/topics/opcodes-and-status-codes
const DELETE_CODES = new Set([10007, 10013, 50035])

/**
 * @param {import('discord.js').Client} bot
 * @param {import('@synzen/discord-rest').RESTProducer|null} restProducer
 * @returns {number}
 */
async function pruneProfileAlerts (bot, restProducer) {
  const log = createLogger(bot.shard.ids[0])
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
    for (var i = userAlerts.length - 1; i >= 0; --i) {
      const memberID = userAlerts[i]
      if (!(/^\d+$/.test(memberID))) {
        // Has non-digits
        log.info(`Deleting invalid alert user "${memberID}"`, guild)
        userAlerts.splice(i, 1)
        updated = true
        continue
      }
      try {
        if (!restProducer) {
          await guild.members.fetch(memberID)
        } else {
          const res = await restProducer.fetch(`https://discord.com/api/guilds/${guild.id}/members/${memberID}`, {
            method: 'GET'
          })
          if (!String(res.status).startsWith('2')) {
            const error = new Error(`Bad status code (${res.status})`)
            error.code = res.body.code
            throw error
          }
        }
      } catch (err) {
        // Either unknown member, user, or invalid ID
        if (DELETE_CODES.has(err.code)) {
          log.info(`Deleting missing alert user "${memberID}"`, guild)
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
