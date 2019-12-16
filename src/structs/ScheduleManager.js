const config = require('../config.js')
const FeedSchedule = require('./FeedSchedule.js')
const debug = require('../util/debugFeeds.js')
const ArticleMessageQueue = require('./ArticleMessageQueue.js')
const log = require('../util/logger.js')
const dbOpsSchedules = require('../util/db/schedules.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const dbOpsVips = require('../util/db/vips.js')
const AssignedScheduleModel = require('../models/AssignedSchedule.js')
const ArticleModel = require('../models/Article.js')

class ScheduleManager {
  constructor (bot) {
    this.bot = bot
    this.articleMessageQueue = new ArticleMessageQueue()
    this.scheduleList = []
  }

  static async initializeSchedules (customSchedules) {
    await dbOpsSchedules.schedules.clear()
    const promises = [
      dbOpsSchedules.schedules.add('default', config.feeds.refreshRateMinutes)
    ]
    if (customSchedules) {
      for (const schedule of customSchedules) {
        const { name, refreshRateMinutes } = schedule
        if (name === 'example') {
          continue
        }
        promises.push(dbOpsSchedules.schedules.add(name, refreshRateMinutes))
      }
    }
    if (config._vip === true) {
      if (!config._vipRefreshRateMinutes || config.feeds.refreshRateMinutes === config._vipRefreshRateMinutes) {
        throw new Error('Missing valid VIP refresh rate')
      }
      promises.push(dbOpsSchedules.schedules.add('vip', config._vipRefreshRateMinutes))
      // refreshRates.add(config._vipRefreshRateMinutes)
    }
    await Promise.all(promises)
  }

  async _queueArticle (article) {
    if (debug.feeds.has(article._delivery.rssName)) {
      log.debug.info(`${article._delivery.rssName} ScheduleManager queueing article ${article.link} to send`)
    }
    try {
      await this.articleMessageQueue.enqueue(article)
    } catch (err) {
      if (config.log.linkErrs === true) {
        const channel = this.bot.channels.get(article._delivery.source.channel)
        log.general.warning(`Failed to send article ${article.link}`, channel.guild, channel, err)
        if (err.code === 50035) {
          channel.send(`Failed to send formatted article for article <${article.link}> due to misformation.\`\`\`${err.message}\`\`\``).catch(err => log.general.warning(`Unable to send failed-to-send message for article`, err))
        }
      }
    }
  }

  _finishSchedule () {
    this.articleMessageQueue.send(this.bot)
      .catch(err => log.general.error('Failed to send a delayed articleMessage', err, err.guild, true))
  }

  async _registerSchedules () {
    const schedules = await dbOpsSchedules.schedules.getAll()
    for (const schedule of schedules) {
      const feedSchedule = new FeedSchedule(this.bot, schedule, this)
      this.scheduleList.push(feedSchedule)
      feedSchedule.on('article', this._queueArticle.bind(this))
      feedSchedule.on('finish', this._finishSchedule.bind(this))
      if (this.bot.shard && this.bot.shard.count > 0) {
        process.send({ _drss: true, type: 'addCustomSchedule', schedule: schedule })
      }
    }
  }

  run (refreshRate) { // Run schedules with respect to their refresh times
    for (var feedSchedule of this.scheduleList) {
      if (feedSchedule.refreshRate === refreshRate) {
        return feedSchedule.run().catch(err => log.cycle.error(`${this.bot.shard && this.bot.shard.count > 0 ? `SH ${this.bot.shard.id} ` : ''}Schedule ${this.name} failed to run cycle`, err))
      }
    }
    // If there is no schedule with that refresh time
    if (this.bot.shard && this.bot.shard.count > 0) process.send({ _drss: true, type: 'scheduleComplete', refreshRate })
  }

  stopSchedules () {
    this.scheduleList.forEach(schedule => schedule.stop())
  }

  startSchedules () {
    this.scheduleList.forEach(schedule => schedule.start())
  }

  getSchedule (name) {
    for (const schedule of this.scheduleList) {
      if (schedule.name === name) return schedule
    }
  }

  static async assignSchedules (shard, guildIds) {
    // Remove the old schedules
    const promises = [
      dbOpsSchedules.assignedSchedules.clear(),
      dbOpsSchedules.schedules.getAll(),
      dbOpsGuilds.getAll()
    ]

    if (config._vip === true) {
      promises.push(dbOpsVips.getAll())
    }

    const results = await Promise.all(promises)

    const scheduleList = results[1]
    const guildIdsSet = new Set(guildIds)
    const schedulesByName = {}
    for (const schedule of scheduleList) {
      schedulesByName[schedule.name] = schedule
    }

    const guildRssList = results[2]
    const vipServers = []
    if (config._vip === true) {
      const vipUsers = results[3]
      for (const vipUser of vipUsers) {
        if (vipUser.invalid || vipUser.regularRefreshRate) {
          continue
        }
        for (const serverId of vipUser.servers) {
          vipServers.push(serverId)
        }
      }
    }
    const scheduleDeterminationPromises = []
    const feedRecords = []
    guildRssList.forEach(guildRss => {
      if (!guildIdsSet.has(guildRss.id)) {
        return
      }
      const rssList = guildRss.sources
      for (const rssName in rssList) {
        scheduleDeterminationPromises.push(ScheduleManager.determineSchedule(rssName, guildRss, vipServers, shard, scheduleList))
        feedRecords.push({ feedID: rssName, guildID: guildRss.id, link: rssList[rssName].link })
      }
    })
    const scheduleNames = await Promise.all(scheduleDeterminationPromises)
    const documentsToInsert = []
    const AssignedSchedule = AssignedScheduleModel.model()
    for (let i = 0; i < scheduleNames.length; ++i) {
      const scheduleName = scheduleNames[i]
      const { feedID, link, guildID } = feedRecords[i]
      log.debug.info(`${feedID}: Determined schedule is ${scheduleName}`)
      const toInsert = { feedID, schedule: scheduleName, link, guildID, shard }
      documentsToInsert.push(new AssignedSchedule(toInsert))
    }

    await dbOpsSchedules.assignedSchedules.setMany(documentsToInsert)
  }

  static async determineSchedule (rssName, guildRss, vipServers, shardID, scheduleList) {
    if (config._vip === true && !vipServers) {
      vipServers = []
      const vipUsers = await dbOpsVips.getAll()
      for (const vipUser of vipUsers) {
        if (vipUser.invalid) {
          continue
        }
        for (const serverId of vipUser.servers) {
          vipServers.push(serverId)
        }
      }
    }

    if (!scheduleList) {
      scheduleList = await dbOpsSchedules.schedules.getAll()
    }

    const source = guildRss.sources[rssName]
    let assignedSchedule = await dbOpsSchedules.assignedSchedules.get(rssName, shardID)

    // Take care of our VIPs
    if (config._vip === true && !source.link.includes('feed43')) {
      const validVip = vipServers.includes(guildRss.id)
      if (validVip && assignedSchedule !== 'vip') {
        return 'vip'
      }
    }

    if (!assignedSchedule) {
      for (const schedule of scheduleList) {
        if (schedule.name === 'default' || (config._vip === true && schedule.name === 'vip')) {
          continue
        }
        // Check if non-default schedules first
        // rssnames first
        const feedIDs = schedule.feedIDs // Potential array
        if (feedIDs && feedIDs.has(rssName)) {
          return schedule.name
        }
        // keywords second
        const sKeywords = schedule.keywords
        if (!sKeywords) {
          continue
        }
        for (const word of sKeywords) {
          if (!source.link.includes(word)) {
            continue
          }
          return schedule.name
        }
      }

      if (!assignedSchedule) {
        return 'default'
      }
    }
  }

  static async reassignSchedule (feedID, guildRss, shardId, vipServers) {
    await ScheduleManager.removeScheduleOfFeed(feedID, guildRss.sources[feedID].link)
    await this.assignSchedule(feedID, guildRss, shardId, vipServers)
  }

  static async assignSchedule (feedID, guildRss, shardId, vipServers) {
    const scheduleName = await ScheduleManager.determineSchedule(feedID, guildRss, vipServers, shardId)
    return dbOpsSchedules.assignedSchedules.set(feedID, scheduleName, guildRss.sources[feedID].link, guildRss.id)
  }

  static async removeScheduleOfFeed (feedID, link, shardID) {
    const assigned = await dbOpsSchedules.assignedSchedules.get(feedID)
    if (!assigned) return
    // const shardID = this.bot.shard ? this.bot.shard.id : 0
    await dbOpsSchedules.assignedSchedules.remove(feedID)
    const assignedSchedules = await dbOpsSchedules.assignedSchedules.getMany(shardID, assigned.schedule, link)
    if (assignedSchedules.length === 0 && config.database.uri.startsWith('mongo')) {
      ArticleModel.model(link, shardID, assigned.schedule).collection.drop().catch(err => err.code === 26 ? null : log.general.error('Failed to drop unused collection after feed removal', err))
    }
  }

  cyclesInProgress (name) {
    for (var feedSchedule of this.scheduleList.length) {
      if (name && feedSchedule.name === name && feedSchedule.inProgress) return true
      else if (feedSchedule.inProgress) return true
    }
    return false
  }
}

module.exports = ScheduleManager
