const config = require('../config.js')
const FeedSchedule = require('./FeedSchedule.js')
const debugFeeds = require('../util/debugFeeds.js').list
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

  async _queueArticle (article) {
    if (debugFeeds.includes(article._delivery.rssName)) log.debug.info(`${article._delivery.rssName} ScheduleManager queueing article ${article.link} to send`)
    try {
      await this.articleMessageQueue.send(article)
    } catch (err) {
      if (config.log.linkErrs === true) {
        const channel = this.bot.channels.get(article._delivery.channelId)
        log.general.warning(`Failed to send article ${article.link}`, channel.guild, channel, err)
        if (err.code === 50035) channel.send(`Failed to send formatted article for article <${article.link}> due to misformation.\`\`\`${err.message}\`\`\``).catch(err => log.general.warning(`Unable to send failed-to-send message for article`, err))
      }
    }
  }

  _finishSchedule () {
    this.articleMessageQueue.sendDelayed()
  }

  async addSchedule (schedule, assignAllSchedules, doNotStart) {
    if (!schedule) {
      throw new TypeError('Undefined schedule')
    }
    if (schedule.name !== 'default' && (!schedule.refreshRateMinutes || (!schedule.keywords && !schedule.feedIDs))) {
      throw new TypeError('refreshRateMinutes, keywords or feedIDs is missing in schedule to addSchedule')
    }
    if (this.scheduleList.length === 0 && (!this.bot.shard || this.bot.shard.count === 0)) {
      await dbOpsSchedules.schedules.clear() // Only clear if it is unsharded, otherwise it's clearing multiple times on multiple shards
    }
    const feedSchedule = new FeedSchedule(this.bot, schedule, this)
    await dbOpsSchedules.schedules.add(schedule.name, schedule.refreshRateMinutes)
    this.scheduleList.push(feedSchedule)
    feedSchedule.on('article', this._queueArticle.bind(this))
    feedSchedule.on('finish', this._finishSchedule.bind(this))
    if (this.bot.shard && this.bot.shard.count > 0) {
      process.send({ _drss: true, type: 'addCustomSchedule', schedule: schedule })
    }
    if (assignAllSchedules) {
      await this.assignAllSchedules()
    }
    if (!doNotStart) {
      feedSchedule.start()
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

  getScheduleOfFeedID (feedID) {
    for (const schedule of this.scheduleList) {
      if (schedule.feedIDs.has(feedID)) return schedule
    }
  }

  async assignAllSchedules () {
    // Remove the old schedules
    if (!this.bot.shard || this.bot.shard.count === 0) {
      // Only clear if it is unsharded, otherwise it's clearing multiple times on multiple shards
      await dbOpsSchedules.assignedSchedules.clear()
    }

    const schedulesByName = {}
    for (const schedule of this.scheduleList) {
      schedule.feedIDs.clear()
      schedulesByName[schedule.name] = schedule
    }

    const guildRssList = await dbOpsGuilds.getAll()
    const vipServers = []
    if (config._vip === true) {
      const vipUsers = await dbOpsVips.getAll()
      for (const vipUser of vipUsers) {
        if (vipUser.invalid) continue
        for (const serverId of vipUser.servers) vipServers.push(serverId)
      }
    }
    const scheduleDeterminationPromises = []
    const feedRecords = []
    guildRssList.forEach(guildRss => {
      if (!this.bot.guilds.has(guildRss.id)) return
      const rssList = guildRss.sources
      for (const rssName in rssList) {
        scheduleDeterminationPromises.push(this.determineSchedule(rssName, guildRss, vipServers))
        feedRecords.push({ feedID: rssName, guildID: guildRss.id, link: rssList[rssName].link })
      }
    })
    const scheduleNames = await Promise.all(scheduleDeterminationPromises)

    const documentsToInsert = []
    const AssignedSchedule = AssignedScheduleModel.model()
    const shard = this.bot.shard && this.bot.shard.count > 0 ? this.bot.shard.id : -1
    for (let i = 0; i < scheduleNames.length; ++i) {
      const scheduleName = scheduleNames[i]
      const { feedID, link, guildID } = feedRecords[i]
      schedulesByName[scheduleName].feedIDs.add(feedID)
      const toInsert = { feedID, schedule: scheduleName, link, guildID, shard }
      documentsToInsert.push(new AssignedSchedule(toInsert))
    }

    await dbOpsSchedules.assignedSchedules.setMany(documentsToInsert)
  }

  async determineSchedule (rssName, guildRss, vipServers) {
    if (config._vip === true && !vipServers) {
      vipServers = []
      const vipUsers = await dbOpsVips.getAll()
      for (const vipUser of vipUsers) {
        if (vipUser.invalid) continue
        for (const serverId of vipUser.servers) vipServers.push(serverId)
      }
    }

    const shardID = this.bot.shard ? this.bot.shard.id : undefined
    const source = guildRss.sources[rssName]
    let assignedSchedule = await dbOpsSchedules.assignedSchedules.get(rssName, shardID)

    // Take care of our VIPs
    if (config._vip === true && !source.link.includes('feed43')) {
      const validVip = vipServers.includes(guildRss.id)
      if (validVip) {
        if (assignedSchedule !== 'vip') {
          return 'vip'
        }
      }
    }

    if (!assignedSchedule) {
      for (const schedule of this.scheduleList) {
        if (schedule.name === 'default' || (config._vip === true && schedule.name === 'vip')) continue
        // Check if non-default schedules first
        // rssnames first
        const feedIDs = schedule.feedIDs // Potential array
        if (feedIDs && feedIDs.has(rssName)) {
          return schedule.name
        }
        // keywords second
        const sKeywords = schedule.keywords
        if (!sKeywords) continue
        for (const word of sKeywords) {
          if (!source.link.includes(word)) continue
          return schedule.name
        }
      }

      if (!assignedSchedule) return 'default'
    }
  }

  async assignSchedule (feedID, guildRss, vipServers) {
    const scheduleName = await this.determineSchedule(feedID, guildRss, vipServers)
    const schedule = this.getSchedule(scheduleName)
    schedule.feedIDs.add(feedID)
    await dbOpsSchedules.assignedSchedules.set(feedID, scheduleName, guildRss.sources[feedID].link, guildRss.id)
    return scheduleName
  }

  async removeScheduleOfFeed (feedID, link) {
    const schedule = await this.getScheduleOfFeedID(feedID)
    if (!schedule) return
    schedule.feedIDs.delete(feedID)
    const shardID = this.bot.shard ? this.bot.shard.id : 0
    await dbOpsSchedules.assignedSchedules.remove(feedID)
    const assignedSchedules = await dbOpsSchedules.assignedSchedules.getMany(shardID, schedule.name, link)
    if (assignedSchedules.length === 0 && config.database.uri.startsWith('mongo')) {
      ArticleModel.model(link, shardID, schedule.name).collection.drop().catch(err => err.code === 26 ? null : log.general.error('Failed to drop unused collection after feed removal', err))
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
