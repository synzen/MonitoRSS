const config = require('../../../config.js')
const userServices = require('../../services/user.js')
const guildServices = require('../../services/guild.js')
const roleServices = require('../../services/role.js')
const channelServices = require('../../services/channel.js')
const feedServices = require('../../services/feed.js')
const Feed = require('../../../structs/db/Feed.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function cp (req, res, next) {
  try {
    const userID = req.session.identity.id
    const accessToken = req.session.token.access_token
    const [ guildsData, user, bot ] = await Promise.all([
      userServices.getGuildsWithPermission(userID, accessToken),
      userServices.getUserByAPI(userID, accessToken),
      userServices.getUser(config.web.clientId)
    ])

    const data = {
      owner: config.bot.ownerIDs.includes(userID),
      defaultConfig: config.feeds,
      csrfToken: req.csrfToken(),
      user,
      bot,
      guilds: {},
      failCounters: {},
      assignedSchedules: {}
    }

    for (const data of guildsData) {
      const guild = data.discord
      const [
        guildData,
        limit,
        channels,
        roles
      ] = await Promise.all([
        guildServices.getAppData(guild.id),
        guildServices.getFeedLimit(guild.id),
        channelServices.getChannels(guild.channels),
        roleServices.getRoles(guild.roles)
      ])

      data.guilds[guild.id] = {
        discord: guild,
        data: guildData,
        shard: guild.shard,
        roles,
        limit,
        channels
      }

      const constructedFeeds = guildData.feeds.map(f => new Feed(f))

      // Fail counters and schedules with refresh rates
      const [ failCounters, assignedSchedules ] = await Promise.all([
        feedServices.getFailCounters(constructedFeeds),
        feedServices.determineSchedules(constructedFeeds)
      ])

      data.failCounters = {
        ...data.failCounters,
        ...failCounters
      }

      data.assignedSchedules = {
        ...data.assignedSchedules,
        ...assignedSchedules
      }
    }
  } catch (err) {
    next(err)
  }
}

module.exports = cp
