const express = require('express')
const guilds = express.Router()
const axios = require('axios')
const statusCodes = require('../../constants/codes.js')
const discordAPIConstants = require('../../constants/discordAPI.js')
const dbOps = require('../../../util/dbOps.js')
const redisOps = require('../../../util/redisOps.js')
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
    var guildId = req.params.guildId
    var userId = req.session.identity.id
    if (!guildId) return res.status(400).json({ code: 400, message: 'Guild ID is not defined in parameter' })
    // First see if they are cached
    const [ ownerId, isManager, isMember, notManager, guild, guildRss ] = await Promise.all([
      redisOps.guilds.getValue(guildId, 'ownerID'),
      redisOps.members.isManagerOfGuild(userId, guildId),
      redisOps.members.isMemberOfGuild(userId, guildId),
      redisOps.members.isNotManagerOfGuild(userId, guildId),
      redisOps.guilds.get(guildId),
      dbOps.guildRss.get(guildId)
    ])
    req.guildRss = guildRss
    req.guild = guild

    const isOwner = ownerId === userId
    // The notManager is checked first because they are explicitly recorded by failed API requests, meaning the bot has no permission in that guild
    // isMember must also be checked - if they are, then they are cached - otherwise an API request should be made to check if they're authorized
    const nonManagerByApi = !isMember && notManager && !isOwner
    const nonManagerByCache = isMember && !isManager && !isOwner
    if (nonManagerByApi || nonManagerByCache) return res.status(401).json({ code: 401, message: 'Unauthorized member' })
    if (isManager || isOwner) return next()

    // The remaining condition is that the user is not a member of the guild. This could mean they're uncached, or unauthorized.
    log.general.info(`[1 DISCORD API REQUEST] [BOT] MIDDLEWARE /api/guilds`)
    const memberJson = (await axios.get(`${discordAPIConstants.apiHost}/guilds/${guildId}/members/${userId}`, BOT_HEADERS)).data

    // Now check if they have the permissions
    let memberHasPerm = false
    const memberRoles = memberJson.roles
    if (!memberHasPerm) {
      for (const roleId of memberRoles) {
        if (!(await redisOps.roles.isManagerOfGuild(roleId, guildId))) continue
        await redisOps.members.addManagerManual(userId, guildId)
        return next()
      }
      await redisOps.members.addNonManager(userId, guildId)
      return res.status(401).json({ code: 401, message: 'Unauthorized member' })

      // The below is used if we were to fetch the roles of a guild, and compare them against the member roles
      // for (const roleObject of rolesArray) {
      //   const roleId = roleObject.id
      //   if (!memberJson.roles.includes(roleId)) continue
      //   memberHasPerm = memberHasPerm || ((roleObject.permissions & MANAGE_CHANNEL_PERMISSION) === MANAGE_CHANNEL_PERMISSION) || ((roleObject.permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION)
      // }
    }
  } catch (err) {
    if (err.response && (err.response.status === 403 || err.response.status === 401)) {
      redisOps.members.addNonManager(userId, guildId).then(() => {
        next(err)
      }).catch(redisErr => {
        log.general.warning(`Redis failed to store nonmanager after 401/403 response from discord for checkUserGuildPermission (Guild ${guildId}, User ${userId})`, redisErr)
        next(err)
      })
    } else next(err)
  }
}

const getGuildId = (req, res, next) => {
  if (!req.guildRss) return res.status(404).json({ code: 404, message: statusCodes['404'].message })
  res.json(req.guildRss)
}

const patchGuildId = async (req, res, next) => {
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
    req.patchResult = await dbOps.guildRss.update(req.guildRss)
    next()
  } catch (err) {
    next(err)
  }
}

const deleteGuildId = async (req, res, next) => {
  try {
    if (!req.guildRss) return res.status(404).json({ code: 404, message: 'Cannot edit guild when there are no feeds' })
    req.deleteResult = await dbOps.guildRss.remove({ id: req.params.guildId })
    next()
  } catch (err) {
    next(err)
  }
}

guilds.use('/:guildId', checkUserGuildPermission)

guilds.get('/:guildId', getGuildId)

// Modify a guild profile, and create it if it doesn't exist before the PATCH
guilds.patch(`/:guildId`, patchGuildId)

guilds.delete('/:guildId', deleteGuildId)

module.exports = {
  constants: {
    VALID_GUILD_PATCH_TYPES,
    GUILD_PATCH_DEFAULTS
  },
  middleware: {
    checkUserGuildPermission
  },
  routes: {
    getGuildId,
    patchGuildId,
    deleteGuildId
  },
  router: guilds
}
