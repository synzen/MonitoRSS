const axios = require('axios')
const moment = require('moment')
const log = require('../../util/logger.js')
const discordAPIConstants = require('../constants/discordAPI.js')
const discordAPIHeaders = require('../constants/discordAPIHeaders.js')
const CACHE_TIME_MINUTES = 10
const CACHED_USERS = {}
const CACHED_USERS_GUILDS = {}

function timeDiffMinutes (start) {
  const duration = moment.duration(moment().diff(start))
  return duration.asMinutes()
}

async function info (id, accessToken, skipCache) {
  const cachedUser = id && !skipCache ? CACHED_USERS[id] : null
  if (cachedUser && timeDiffMinutes(cachedUser.lastUpdated) <= CACHE_TIME_MINUTES) return cachedUser.data
  log.web.info(`[1 DISCORD API REQUEST] [USER] GET /api/users/@me`)
  const { data } = await axios.get(`${discordAPIConstants.apiHost}/users/@me`, discordAPIHeaders.user(accessToken))
  CACHED_USERS[id] = {
    data,
    lastUpdated: moment()
  }
  return data
}

async function guilds (id, accessToken, skipCache) {
  const cachedUserGuilds = id && !skipCache ? CACHED_USERS_GUILDS[id] : null
  if (cachedUserGuilds && timeDiffMinutes(cachedUserGuilds.lastUpdated) <= CACHE_TIME_MINUTES) return cachedUserGuilds.data
  log.web.info(`[1 DISCORD API REQUEST] [USER] GET /api/users/@me/guilds`)
  const { data } = await axios.get(`${discordAPIConstants.apiHost}/users/@me/guilds`, discordAPIHeaders.user(accessToken))
  CACHED_USERS_GUILDS[id] = {
    data,
    lastUpdated: moment()
  }
  return data
}

module.exports = { info, guilds }
