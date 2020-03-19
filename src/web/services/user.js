const fetch = require('node-fetch')
const discordAPIConstants = require('../constants/discordAPI.js')
const discordAPIHeaders = require('../constants/discordAPIHeaders.js')
const roleServices = require('./role.js')
const RedisUser = require('../../structs/db/Redis/User.js')
const RedisGuildMember = require('../../structs/db/Redis/GuildMember.js')
const createLogger = require('../../util/logger/create.js')
const WebCache = require('../models/WebCache.js').model
const getConfig = require('../../config.js').get
const log = createLogger('W')
const MANAGE_CHANNEL_PERMISSION = 16

async function getCachedUser (id) {
  return WebCache.findOne({
    id,
    type: 'user'
  }).lean().exec()
}

async function getCachedUserGuilds (id) {
  return WebCache.findOne({
    id,
    type: 'guilds'
  }).lean().exec()
}

async function storeCachedUser (id, data) {
  const cached = new WebCache({
    id,
    type: 'user',
    data
  })
  await cached.save()
  return cached
}

async function storeCachedUserGuilds (id, data) {
  const cached = new WebCache({
    id,
    type: 'guilds',
    data
  })
  await cached.save()
  return cached
}

async function getUserByAPI (id, accessToken, skipCache) {
  const cachedUser = id && !skipCache ? await getCachedUser(id) : null
  if (cachedUser) {
    return cachedUser.data
  }
  log.info(`[1 DISCORD API REQUEST] [USER] GET /api/users/@me`)
  const results = await fetch(`${discordAPIConstants.apiHost}/users/@me`, discordAPIHeaders.user(accessToken))
  if (results.status !== 200) {
    throw new Error(`Bad Discord status code (${results.status})`)
  }
  const data = await results.json()
  await storeCachedUser(data.id, data)
  return data
}

async function getUser (id) {
  const user = await RedisUser.fetch(id)
  return user ? user.toJSON() : null
}

async function getGuildsByAPI (id, accessToken, skipCache) {
  const cachedUserGuilds = !skipCache ? await getCachedUserGuilds(id) : null
  if (cachedUserGuilds) {
    return cachedUserGuilds.data
  }
  log.info(`[1 DISCORD API REQUEST] [USER] GET /api/users/@me/guilds`)
  const res = await fetch(`${discordAPIConstants.apiHost}/users/@me/guilds`, discordAPIHeaders.user(accessToken))
  if (res.status !== 200) {
    throw new Error(`Bad Discord status code (${res.status})`)
  }
  const data = await res.json()
  await storeCachedUserGuilds(id, data)
  return data
}

/**
 * @param {Object<string, any>} guild - User guild data from API
 * @returns {Promise<boolean>}
 */
async function hasGuildPermission (guild) {
  const config = getConfig()
  // User permission
  const isOwner = guild.owner
  const managesChannel = (guild.permissions & MANAGE_CHANNEL_PERMISSION) === MANAGE_CHANNEL_PERMISSION
  if (!isOwner && !managesChannel) {
    return false
  }
  // Bot permission - just has to be in guild
  const member = await getMemberOfGuild(config.web.clientID, guild.id)
  if (!member) {
    return false
  }
  return true
}

/**
 * @param {string} userID
 * @param {string} guildID
 */
async function getMemberOfGuild (userID, guildID) {
  const member = await RedisGuildMember.fetch({
    id: userID,
    guildID
  })
  return member
}

/**
 * @param {string} userID
 * @param {string} guildID
 */
async function isManagerOfGuild (userID, guildID) {
  const member = await getMemberOfGuild(userID, guildID)
  const config = getConfig()
  const isBotOwner = config.bot.ownerIDs.includes(userID)
  const isManager = member && member.isManager
  if (isBotOwner || isManager) {
    return true
  }
  if (member) {
    return false
  }
  // At this point, the member is not cached - so check the API
  return isManagerOfGuildByAPI(userID, guildID)
}

/**
 * @param {string} userID
 * @param {string} guildID
 */
async function isManagerOfGuildByAPI (userID, guildID) {
  log.general.info(`[1 DISCORD API REQUEST] [BOT] MIDDLEWARE /api/guilds/:guildId/members/:userId`)
  const res = await fetch(`${discordAPIConstants.apiHost}/guilds/${guildID}/members/${userID}`, discordAPIHeaders.bot())
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
  throw new Error(`Bad Discord status code (${results.status})`)
}

module.exports = {
  getUserByAPI,
  getUser,
  getGuildsByAPI,
  isManagerOfGuild,
  isManagerOfGuildByAPI,
  getMemberOfGuild,
  hasGuildPermission
}
