const express = require('express')
const cp = express.Router()
const config = require('../../../config.js')
const dbOpsVips = require('../../../util/db/vips.js')
const dbOpsGuilds = require('../../../util/db/guilds.js')
const dbOpsSchedules = require('../../../util/db/schedules.js')
const dbOpsFailedLinks = require('../../../util/db/failedLinks.js')
const MANAGE_CHANNEL_PERMISSION = 16
const ADMINISTRATOR_PERMISSION = 8
const RedisUser = require('../../../structs/db/Redis/User.js')
const RedisGuild = require('../../../structs/db/Redis/Guild.js')
const RedisRole = require('../../../structs/db/Redis/Role.js')
const RedisChannel = require('../../../structs/db/Redis/Channel.js')
const serverLimit = require('../../../util/serverLimit.js')
const fetchUser = require('../../util/fetchUser.js')
// All API routes tries to mirror Discord's own API routes

async function get (req, res, next) {
  try {
    const [ user, bot, apiGuilds ] = await Promise.all([
      fetchUser.info(req.session.identity.id, req.session.auth.access_token),
      RedisUser.fetch(config.web.clientId),
      fetchUser.guilds(req.session.identity.id, req.session.auth.access_token) ])
    const guildCacheResults = await Promise.all(apiGuilds.map(discordGuild => RedisGuild.fetch(discordGuild.id)))
    const approvedProfilesPromises = []
    const approvedGuilds = []
    for (let i = 0; i < apiGuilds.length; ++i) {
      const discordGuild = apiGuilds[i]
      const guildInCache = guildCacheResults[i]
      if (!guildInCache || (!discordGuild.owner && (discordGuild.permissions & MANAGE_CHANNEL_PERMISSION) !== MANAGE_CHANNEL_PERMISSION && (discordGuild.permissions & ADMINISTRATOR_PERMISSION) !== ADMINISTRATOR_PERMISSION)) continue

      // Now get the guildRss
      approvedProfilesPromises.push(dbOpsGuilds.get(discordGuild.id))
      approvedGuilds.push(discordGuild)
    }
    const guildRsses = await Promise.all(approvedProfilesPromises)

    const data = {
      owner: config.bot.ownerIDs.includes(req.session.identity.id),
      defaultConfig: config.feeds,
      csrfToken: req.csrfToken(),
      user,
      bot: bot.toJSON(),
      guilds: {}
    }

    const allVips = await dbOpsVips.getAll()
    const feedIDs = []
    const feedLinks = []
    for (let i = 0; i < guildRsses.length; ++i) {
      const guildRss = guildRsses[i]
      const discordProfile = approvedGuilds[i]
      const guildID = discordProfile.id
      const cachedGuild = guildCacheResults.find(guild => guild && guild.id === guildID)

      // shard id
      const shard = cachedGuild.shard

      // roles
      const roleIDs = cachedGuild.roles
      const unadjustedRoles = await Promise.all(roleIDs.map(roleID => RedisRole.fetch(roleID)))
      const roles = unadjustedRoles.map(role => {
        const data = role.toJSON()
        return { ...data, hexColor: data.hexColor === '#000000' ? '' : data.hexColor }
      }).sort((a, b) => b.position - a.position)

      // channels
      const channelIDs = cachedGuild.channels
      const channelsData = await Promise.all(channelIDs.map(channelID => RedisChannel.fetch((channelID))))
      const channels = channelsData.map(redisChannel => redisChannel.toJSON())

      // server limit
      const { max } = await serverLimit(guildID, allVips)

      data.guilds[guildID] = {
        shard,
        discord: discordProfile,
        profile: guildRss,
        maxFeeds: max,
        roles,
        channels
      }

      if (guildRss && guildRss.sources) {
        for (const rssName in guildRss.sources) {
          feedIDs.push(rssName)
          const link = guildRss.sources[rssName].link
          if (!feedLinks.includes(link)) feedLinks.push(link)
        }
      }
    }

    const [ linkStatusResults, assignedSchedules, schedules ] = await Promise.all([ dbOpsFailedLinks.getMultiple(feedLinks), dbOpsSchedules.assignedSchedules.getManyByIDs(feedIDs), dbOpsSchedules.schedules.getAll() ])
    const refreshRatesBySchedule = {}
    for (const schedule of schedules) {
      refreshRatesBySchedule[schedule.name] = schedule.refreshRateMinutes
    }

    // Links statuses
    if (feedLinks.length > 0) {
      const linksStatus = {}
      for (const result of linkStatusResults) {
        if (!result) continue // OK, don't return anything
        if (result.failed) linksStatus[result.link] = result.failed // FAILED
        else linksStatus[result.link] = result.count // OK so far
      }
      data.linksStatus = linksStatus
    }

    if (feedIDs.length > 0) {
      const feedRefreshRates = {}
      const scheduleNames = []
      for (const assigned of assignedSchedules) {
        const refreshRate = refreshRatesBySchedule[assigned.schedule]
        if (refreshRate) feedRefreshRates[assigned.feedID] = refreshRate
        scheduleNames.push(assigned.schedule)
      }
      data.feedRefreshRates = feedRefreshRates
    }

    // console.log(JSON.stringify(data, null, 2))
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
