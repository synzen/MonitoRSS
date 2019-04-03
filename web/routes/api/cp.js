const express = require('express')
const cp = express.Router()
const config = require('../../../config.js')
const dbOps = require('../../../util/dbOps.js')
const MANAGE_CHANNEL_PERMISSION = 16
const ADMINISTRATOR_PERMISSION = 8
const redisOps = require('../../../util/redisOps.js')
const serverLimit = require('../../../util/serverLimit.js')
const fetchUser = require('../../util/fetchUser.js')
// All API routes tries to mirror Discord's own API routes

async function get (req, res, next) {
  try {
    const [ user, bot, apiGuilds ] = await Promise.all([ fetchUser.info(req.session.identity.id, req.session.auth.access_token), redisOps.users.get(config.web.clientId), fetchUser.guilds(req.session.identity.id, req.session.auth.access_token) ])
    const guildCacheResults = await Promise.all(apiGuilds.map(discordGuild => redisOps.guilds.exists(discordGuild.id)))
    const approvedProfilesPromises = []
    const approvedGuilds = []
    for (let i = 0; i < apiGuilds.length; ++i) {
      const discordGuild = apiGuilds[i]
      const guildInCache = guildCacheResults[i]
      if (!guildInCache || (!discordGuild.owner && (discordGuild.permissions & MANAGE_CHANNEL_PERMISSION) !== MANAGE_CHANNEL_PERMISSION && (discordGuild.permissions & ADMINISTRATOR_PERMISSION) !== ADMINISTRATOR_PERMISSION)) continue

      // Now get the guildRss
      approvedProfilesPromises.push(dbOps.guildRss.get(discordGuild.id))
      approvedGuilds.push(discordGuild)
    }
    const guildRsses = await Promise.all(approvedProfilesPromises)

    const data = {
      defaultConfig: config.feeds,
      csrfToken: req.csrfToken(),
      user,
      bot,
      guilds: {}
    }

    const feedLinks = []
    const allVips = await dbOps.vips.getAll()
    for (let i = 0; i < guildRsses.length; ++i) {
      const guildRss = guildRsses[i]
      const discordProfile = approvedGuilds[i]
      const guildId = discordProfile.id

      // roles
      const roleIds = await redisOps.roles.getRolesOfGuild(guildId)
      const unadjustedRoles = await Promise.all(roleIds.map(roleId => redisOps.roles.get(roleId)))
      const roles = unadjustedRoles.map(role => { return { ...role, position: +role.position, hexColor: role.hexColor === '#000000' ? '' : role.hexColor } }).sort((a, b) => b.position - a.position)

      // channels
      const channelIds = await redisOps.channels.getChannelsOfGuild(guildId)
      const channelNames = await Promise.all(channelIds.map(channelId => redisOps.channels.getName(channelId)))
      const channels = channelNames.map((name, index) => {
        return { id: channelIds[index], name }
      })

      // server limit
      const { max } = await serverLimit(guildId, allVips)

      data.guilds[guildId] = {
        discord: discordProfile,
        profile: guildRss,
        maxFeeds: max,
        roles,
        channels
      }
      if (guildRss && guildRss.sources) {
        for (const rssName in guildRss.sources) {
          const link = guildRss.sources[rssName].link
          if (!feedLinks.includes(link)) feedLinks.push(link)
        }
      }
    }

    // Links statuses
    if (feedLinks.length > 0) {
      const results = await dbOps.failedLinks.getMultiple(feedLinks)
      const linksStatus = {}
      for (const result of results) {
        if (!result) continue // OK, don't return anything
        if (result.failed) linksStatus[result.link] = result.failed // FAILED
        else linksStatus[result.link] = result.count // OK so far
      }
      data.linksStatus = linksStatus
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
}

cp.get('/', get)

module.exports = {
  routes: {
    get
  },
  router: cp
}
