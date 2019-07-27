const express = require('express')
const user = express.Router()
const dbOpsGuilds = require('../../../util/db/guilds.js')
const MANAGE_CHANNEL_PERMISSION = 16
const ADMINISTRATOR_PERMISSION = 8
const RedisUser = require('../../../structs/db/Redis/User.js')
const RedisGuild = require('../../../structs/db/Redis/Guild.js')
const fetchUser = require('../../util/fetchUser.js')

async function getMe (req, res, next) {
  try {
    const userCached = await RedisUser.fetch(req.session.identity.id)
    if (userCached) return res.json(userCached.toJSON())
    const data = await fetchUser.info(req.session.identity.id, req.session.auth.access_token)
    // req.session.identity = data
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getBot (req, res, next) {
  try {
    const userCached = await RedisUser.fetch(process.env.DRSS_CLIENT_ID)
    return res.json(userCached ? userCached.toJSON() : {})
  } catch (err) {
    next(err)
  }
}

async function getMeGuilds (req, res, next) {
  try {
    const apiGuilds = await fetchUser.guilds(req.session.identity.id, req.session.auth.access_token)
    const cacheResults = await Promise.all(apiGuilds.map(discordGuild => {
      return RedisGuild.utils.exists(discordGuild.id)
    }))
    const approvedProfilesPromises = []
    const approvedGuilds = []
    for (let i = 0; i < apiGuilds.length; ++i) {
      const discordGuild = apiGuilds[i]
      const guildInCache = cacheResults[i]
      if (!guildInCache || (!discordGuild.owner && (discordGuild.permissions & MANAGE_CHANNEL_PERMISSION) !== MANAGE_CHANNEL_PERMISSION && (discordGuild.permissions & ADMINISTRATOR_PERMISSION) !== ADMINISTRATOR_PERMISSION)) continue
      // Now get the guildRss
      approvedProfilesPromises.push(dbOpsGuilds.get(discordGuild.id))
      approvedGuilds.push(discordGuild)
    }
    if (approvedGuilds.length === 0) return res.json([])
    const guildRsses = await Promise.all(approvedProfilesPromises)

    const profiles = guildRsses.map((profile, index) => {
      return {
        discord: approvedGuilds[index],
        profile: profile || {}
      }
    })

    res.json(profiles)
  } catch (err) {
    next(err)
  }
}

user.get('/@me', getMe)
user.get('/@bot', getBot)
user.get('/@me/guilds', getMeGuilds)

module.exports = {
  routes: {
    getMe,
    getBot,
    getMeGuilds
  },
  router: user
}
