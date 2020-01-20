const fetch = require('node-fetch')
const moment = require('moment')
const log = require('../../util/logger.js')
const discordAPIConstants = require('../constants/discordAPI.js')
const discordAPIHeaders = require('../constants/discordAPIHeaders.js')
const guildServices = require('./guild.js')
const roleServices = require('./role.js')
const RedisUser = require('../../structs/db/Redis/User.js')
const RedisGuildMember = require('../../structs/db/Redis/GuildMember.js')
const config = require('../../config.js')
const MANAGE_CHANNEL_PERMISSION = 16
const ADMINISTRATOR_PERMISSION = 8
const CACHE_TIME_MINUTES = 10
const CACHED_USERS = {}
const CACHED_USERS_GUILDS = {}

function timeDiffMinutes (start) {
  const duration = moment.duration(moment().diff(start))
  return duration.asMinutes()
}

async function getInfo (id, accessToken, skipCache) {
  const cachedUser = id && !skipCache ? CACHED_USERS[id] : null
  if (cachedUser && timeDiffMinutes(cachedUser.lastUpdated) <= CACHE_TIME_MINUTES) {
    return cachedUser.data
  }
  log.web.info(`[1 DISCORD API REQUEST] [USER] GET /api/users/@me`)
  const results = await fetch(`${discordAPIConstants.apiHost}/users/@me`, discordAPIHeaders.user(accessToken))
  if (results.status !== 200) {
    throw new Error('Non-200 status code')
  }
  const data = await results.json()
  CACHED_USERS[id] = {
    data,
    lastUpdated: moment()
  }
  return data
}

async function getBot () {
  const bot = await RedisUser.fetch(config.web.clientId)
  return bot.toJSON()
}

async function getGuilds (id, accessToken, skipCache) {
  const cachedUserGuilds = id && !skipCache ? CACHED_USERS_GUILDS[id] : null
  if (cachedUserGuilds && timeDiffMinutes(cachedUserGuilds.lastUpdated) <= CACHE_TIME_MINUTES) {
    return cachedUserGuilds.data
  }
  log.web.info(`[1 DISCORD API REQUEST] [USER] GET /api/users/@me/guilds`)
  const res = await fetch(`${discordAPIConstants.apiHost}/users/@me/guilds`, discordAPIHeaders.user(accessToken))
  if (res.status !== 200) {
    throw new Error(`Non-200 status code (${res.status})`)
  }
  const data = await res.json()
  CACHED_USERS_GUILDS[id] = {
    data,
    lastUpdated: moment()
  }
  return data
}

async function getGuildsWithPermission (userID, userAccessToken) {
  const apiGuilds = await getGuilds(userID, userAccessToken)
  const guildCache = await Promise.all(apiGuilds.map(discordGuild => guildServices.getGuild(discordGuild.id)))
  const guildCacheApproved = []
  for (let i = 0; i < apiGuilds.length; ++i) {
    const discordGuild = apiGuilds[i]
    const guildInCache = guildCache[i]
    if (!guildInCache) {
      continue
    }
    const isOwner = discordGuild.owner
    const managesChannel = (discordGuild.permissions & MANAGE_CHANNEL_PERMISSION) === MANAGE_CHANNEL_PERMISSION
    const isAdministrator = (discordGuild.permissions & ADMINISTRATOR_PERMISSION) !== ADMINISTRATOR_PERMISSION
    if (!isOwner && !managesChannel && !isAdministrator) {
      continue
    }
    guildCacheApproved.push(guildInCache)
  }
  return guildCacheApproved
}

async function isManagerOfGuild (userID, guild) {
  const member = await RedisGuildMember.fetch({
    id: userID,
    guildID: guild.id
  })
  const isBotOwner = config.bot.ownerIDs.includes(userID)
  const isGuildOwner = guild.ownerID === userID
  const isManager = member && member.isManager
  if (isBotOwner || isGuildOwner || isManager) {
    return true
  }
  if (member) {
    return false
  }
  // At this point, the member is not cached - so check the API
  return isManagerOfGuildByAPI(userID, guild.id)
}

async function isManagerOfGuildByAPI (userID, guildID) {
  log.general.info(`[1 DISCORD API REQUEST] [BOT] MIDDLEWARE /api/guilds/:guildId/members/:userId`)
  const res = await fetch(`${discordAPIConstants.apiHost}/guilds/${guildID}/members/${userID}`, discordAPIHeaders.bot)
  if (res.status === 200) {
    const user = await res.json()
    const roles = user.roles
    for (const id of roles) {
      const isManager = await roleServices.isManagerOfGuild(id, guildID)
      if (isManager) {
        // Store the user as manager member
        await RedisGuildMember.utils.recognizeManagerManual(userID, guildID)
        return true
      }
    }
    // Store the user as member
    await RedisGuildMember.utils.recognizeManual(userID, guildID)
    return false
  }
  if (res.status === 403 || res.status === 401) {
    // Store the user as non-member
    await RedisGuildMember.utils.recognizeNonMember(userID, guildID)
    return false
  }
  throw new Error(`Bad status code (${res.status})`)
}

module.exports = {
  getInfo,
  getBot,
  getGuilds,
  getGuildsWithPermission,
  isManagerOfGuild,
  isManagerOfGuildByAPI
}
