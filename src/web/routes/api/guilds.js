const express = require('express')
const guilds = express.Router()
const axios = require('axios')
const statusCodes = require('../../constants/codes.js')
const discordAPIConstants = require('../../constants/discordAPI.js')
const dbOpsGuilds = require('../../../util/db/guilds.js')
const RedisGuild = require('../../../structs/db/Redis/Guild.js')
const RedisGuildMember = require('../../../structs/db/Redis/GuildMember.js')
const RedisRole = require('../../../structs/db/Redis/Role.js')
const log = require('../../../util/logger.js')
const config = require('../../../config.js')
const moment = require('moment-timezone')
const VALID_GUILD_PATCH_TYPES = {
  sendAlertsTo: [String],
  dateFormat: String,
  dateLanguage: String,
  timezone: String,
  prefix: String
}
const GUILD_PATCH_DEFAULTS = {
  dateFormat: config.feeds.dateFormat,
  dateLanguage: config.feeds.dateLanguage,
  timezone: config.feeds.timezone,
  prefix: config.bot.prefix
}
const BOT_HEADERS = require('../../constants/discordAPIHeaders.js').bot

async function checkUserGuildPermission (req, res, next) {
  try {
    var guildID = req.params.guildID
    var userID = req.session.identity.id
    if (!guildID) return res.status(400).json({ code: 400, message: 'Guild ID is not defined in parameter' })
    // First see if they are cached
    const [ guild, guildRss, member ] = await Promise.all([
      RedisGuild.fetch(guildID),
      dbOpsGuilds.get(guildID),
      RedisGuildMember.fetch({ id: userID, guildID: guildID })
    ])

    if (!guild) return res.status(404).json({ code: 404, message: 'Unknown guild' })
    req.guildRss = guildRss
    req.guild = guild.toJSON()

    if (req.guild.ownerID === userID) return next() // Owner may not always be cached as a member, so check this first
    if (member && member.isManager) return next()
    if (member) return res.status(403).json({ code: 403, message: 'Unauthorized member' })

    // The remaining condition is that the user is not a member of the guild. This could mean they're uncached, or unauthorized.
    log.general.info(`[1 DISCORD API REQUEST] [BOT] MIDDLEWARE /api/guilds`)
    const memberJson = (await axios.get(`${discordAPIConstants.apiHost}/guilds/${guildID}/members/${userID}`, BOT_HEADERS)).data

    // Now check if their roles have the permissions
    let memberHasPerm = false
    const memberRoles = memberJson.roles
    if (!memberHasPerm) {
      for (const roleID of memberRoles) {
        if (await RedisRole.utils.isManagerOfGuild(roleID, guildID)) {
          await RedisGuildMember.utils.recognizeManagerManual(userID, guildID)
          return next()
        }
        // if (!(await redisOps.roles.isManagerOfGuild(roleID, guildID))) continue
        // return next()
      }
      await RedisGuildMember.utils.recognizeManual(userID, guildID)
      return res.status(403).json({ code: 403, message: 'Unauthorized member' })

      // The below is used if we were to fetch the roles of a guild, and compare them against the member roles
      // for (const roleObject of rolesArray) {
      //   const roleID = roleObject.id
      //   if (!memberJson.roles.includes(roleID)) continue
      //   memberHasPerm = memberHasPerm || ((roleObject.permissions & MANAGE_CHANNEL_PERMISSION) === MANAGE_CHANNEL_PERMISSION) || ((roleObject.permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION)
      // }
    }
  } catch (err) {
    // This user is not part of the defined guild
    if (err.response && (err.response.status === 403 || err.response.status === 401)) {
      RedisGuildMember.utils.recognizeNonMember(userID, guildID).then(() => {
        next(err)
      }).catch(redisErr => {
        log.general.warning(`Redis failed to store nonmanager after 401/403 response from discord for checkUserGuildPermission (Guild ${guildID}, User ${userID})`, redisErr)
        next(err)
      })
    } else next(err)
  }
}

const getGuildID = (req, res, next) => {
  if (!req.guildRss) return res.status(404).json({ code: 404, message: statusCodes['404'].message })
  res.json(req.guildRss)
}

const patchGuildID = async (req, res, next) => {
  const errors = {}
  const body = req.body
  if (!req.guildRss) return res.status(404).json({ code: 404, message: 'Cannot edit guild when there are no feeds' })
  // Check for errors first
  for (const key in body) {
    const bodyValue = body[key]
    const wantedType = VALID_GUILD_PATCH_TYPES[key]
    if (!wantedType) errors[key] = 'Invalid setting'
    else if (Array.isArray(wantedType)) {
      const arrayOfCorrectTypes = bodyValue === '' ? true : !Array.isArray(bodyValue) ? false : bodyValue.reduce((total, cur) => total && (cur ? cur.constructor === wantedType[0] : false), true)
      if (!arrayOfCorrectTypes) errors[key] = `Each element of array must be a ${wantedType[0].name}`
    } else {
      if (bodyValue !== '' && (!bodyValue || (bodyValue.constructor !== wantedType))) errors[key] = `Must be a ${wantedType.name}`
      else if (key === 'timezone' && bodyValue !== '' && !moment.tz.zone(bodyValue)) errors[key] = 'Invalid timezone'
    }
  }
  // Send errors if available
  if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })
  // Now for actual changes
  for (const key in body) {
    const val = body[key]
    if (GUILD_PATCH_DEFAULTS[key] !== undefined && val === GUILD_PATCH_DEFAULTS[key]) delete req.guildRss[key]
    else if (val === '') {
      // log.web.info(`(${req.session.identity.id}, ${req.session.identity.username}) (${req.guildRss.id}, ${req.guildRss.name}) Deleted guild profile key "${key}"`)
      delete req.guildRss[key]
    } else if (key === 'timezone') {
      const resolved = moment.tz.zone(val)
      const original = moment.tz.zone(GUILD_PATCH_DEFAULTS[key])
      if (resolved.name === original.name && req.guildRss[key]) {
        delete req.guildRss[key]
      } else {
        req.guildRss[key] = val
      }
    } else {
      req.guildRss[key] = val
    }
  }
  try {
    req.patchResult = await dbOpsGuilds.update(req.guildRss)
    next()
  } catch (err) {
    next(err)
  }
}

const deleteGuildID = async (req, res, next) => {
  try {
    if (!req.guildRss) return res.status(404).json({ code: 404, message: 'Cannot edit guild when there are no feeds' })
    req.deleteResult = await dbOpsGuilds.remove({ id: req.params.guildID })
    next()
  } catch (err) {
    next(err)
  }
}

guilds.use('/:guildID', checkUserGuildPermission)

guilds.get('/:guildID', getGuildID)

// Modify a guild profile, and create it if it doesn't exist before the PATCH
guilds.patch(`/:guildID`, patchGuildID)

guilds.delete('/:guildID', deleteGuildID)

module.exports = {
  constants: {
    VALID_GUILD_PATCH_TYPES,
    GUILD_PATCH_DEFAULTS
  },
  middleware: {
    checkUserGuildPermission
  },
  routes: {
    getGuildID,
    patchGuildID,
    deleteGuildID
  },
  router: guilds
}
