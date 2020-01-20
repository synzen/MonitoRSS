const config = require('../../../config.js')
const userServices = require('../../services/user.js')
const guildServices = require('../../services/guild.js')
const roleServices = require('../../services/role.js')
const channelServices = require('../../services/channel.js')
const feedServices = require('../../services/feed.js')

/**
 * @param {express.Request} req
 * @param {express.Response} res
 */
async function getPanelData (req, res) {
  const userID = req.session.identity.id
  const accessToken = req.session.token.access_token
  const [ guildCacheApproved, user, bot ] = await Promise.all([
    userServices.getGuildsWithPermission(userID, accessToken),
    userServices.getInfo(userID, accessToken),
    userServices.getBot()
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

  for (const guild of guildCacheApproved) {
    const [
      guildData,
      limit,
      channels,
      roles
    ] = await Promise.all([
      guildServices.getAppData(),
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

    // Fail counters and schedules with refresh rates
    const [ failCounters, assignedSchedules ] = await Promise.all([
      feedServices.getFailCounters(guildData.feeds),
      feedServices.determineSchedules(guildData.feeds)
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
}

exports.getPanelData = getPanelData
