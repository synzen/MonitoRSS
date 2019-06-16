const config = require('../config.js')
const FeedSchedule = require('./FeedSchedule.js')
const debugFeeds = require('../util/debugFeeds.js').list
const ArticleMessageQueue = require('./ArticleMessageQueue.js')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')
const dbOps = require('../util/dbOps.js')
const assignedSchedules = require('../util/assignedSchedules.js')

class ScheduleManager {
  constructor (bot, customSchedules) { // Third parameter is only used when config.database.uri is a databaseless folder path
    this.bot = bot
    this.articleMessageQueue = new ArticleMessageQueue()
    this.scheduleList = []
    storage.scheduleManager = this
    // Set up the default schedule
    this.scheduleList.push(new FeedSchedule(this.bot, { name: 'default', refreshTimeMinutes: config.feeds.refreshTimeMinutes }, this))
    // Set up custom schedules
    if (customSchedules) for (var i = 0; i < customSchedules.length; ++i) this.scheduleList.push(new FeedSchedule(this.bot, customSchedules[i], null, this))
    for (const schedule of this.scheduleList) {
      schedule.on('article', this._queueArticle.bind(this))
      schedule.on('finish', this._finishSchedule.bind(this))
    }
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

  addSchedule (schedule) {
    if (!schedule) throw new TypeError('schedule is not defined for addSchedule')
    if ((!config._vip || (config._vip && schedule.name !== 'vip')) && (!schedule.refreshTimeMinutes || (!schedule.keywords && !schedule.rssNames))) throw new TypeError('refreshTimeMinutes, keywords or rssNames is missing in schedule to addSchedule')
    const feedSchedule = new FeedSchedule(this.bot, schedule, this)
    feedSchedule.start()
    this.scheduleList.push(feedSchedule)
    feedSchedule.on('article', this._queueArticle.bind(this))
    feedSchedule.on('finish', this._finishSchedule.bind(this))
    if (this.bot.shard && this.bot.shard.count > 0) process.send({ _drss: true, type: 'addCustomSchedule', schedule: schedule })
  }

  run (refreshTime) { // Run schedules with respect to their refresh times
    for (var feedSchedule of this.scheduleList) {
      if (feedSchedule.refreshTime === refreshTime) {
        return feedSchedule.run().catch(err => log.cycle.error(`${this.bot.shard && this.bot.shard.count > 0 ? `SH ${this.bot.shard.id} ` : ''}Schedule ${this.name} failed to run cycle`, err))
      }
    }
    // If there is no schedule with that refresh time
    if (this.bot.shard && this.bot.shard.count > 0) process.send({ _drss: true, type: 'scheduleComplete', refreshTime: refreshTime })
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
    return null
  }

  async assignSchedules () {
    const guildRssList = await dbOps.guildRss.getAll()
    const vipServers = []
    if (config._vip === true) {
      const vipUsers = await dbOps.vips.getAll()
      for (const vipUser of vipUsers) {
        if (vipUser.invalid) continue
        for (const serverId of vipUser.servers) vipServers.push(serverId)
      }
    }
    guildRssList.forEach(guildRss => {
      if (!this.bot.guilds.has(guildRss.id)) return
      const rssList = guildRss.sources
      for (const rssName in rssList) {
        this.assignScheduleToSource(guildRss, rssName, vipServers)
      }
    })
  }

  async assignScheduleToSource (guildRss, rssName, vipServers) {
    if (config._vip === true && !vipServers) {
      vipServers = []
      const vipUsers = await dbOps.vips.getAll()
      for (const vipUser of vipUsers) {
        if (vipUser.invalid) continue
        for (const serverId of vipUser.servers) vipServers.push(serverId)
      }
    }
    const source = guildRss.sources[rssName]
    let sourceScheduleName = assignedSchedules.getScheduleName(rssName)

    // Take care of our VIPs
    if (config._vip === true && !source.link.includes('feed43')) {
      const validVip = vipServers.includes(guildRss.id)
      const vipSchedule = this.getSchedule('vip')
      if (validVip) {
        if (sourceScheduleName !== 'vip') {
          assignedSchedules.setScheduleName(rssName, 'vip')
          // Only do the below if ran is 0, since on initialization it counted it first already for link tracking purposes
        }
        if (!vipSchedule) this.addSchedule({ name: 'vip', refreshTimeMinutes: config._vipRefreshTimeMinutes ? config._vipRefreshTimeMinutes : 10 }) // Make it
      } else if (!validVip && sourceScheduleName === 'vip') assignedSchedules.clearScheduleName(rssName)
    }

    sourceScheduleName = assignedSchedules.getScheduleName(rssName) // Get the new value since it may be different

    if (!sourceScheduleName) {
      for (const schedule of this.scheduleList) {
        if (schedule.name === 'default') continue
        // Check if non-default schedules first
        // rssnames first
        const sRssNames = schedule.rssNames // Potential array
        if (sRssNames && sRssNames.includes(rssName)) {
          assignedSchedules.setScheduleName(rssName, schedule.name)
          dbOps.linkTracker.increment(source.link, schedule.name).catch(err => log.cycle.warning(`Unable to increment link tracker for link ${source.link} (a)`, err))
          log.cycle.info(`Undelegated feed ${rssName} (${source.link}) has been delegated to custom schedule ${schedule.name} by rssName`)
          break
        }
        // keywords second
        const sKeywords = schedule.keywords
        if (!sKeywords) continue
        sKeywords.forEach(word => {
          if (!source.link.includes(word)) return
          assignedSchedules.setScheduleName(rssName, schedule.name) // Assign this feed to this this.schedule so no other feed this.schedule can take it on subsequent cycles
          dbOps.linkTracker.increment(source.link, schedule.name).catch(err => log.cycle.warning(`Unable to increment link tracker for link ${source.link} (b)`, err))
          log.cycle.info(`Undelegated feed ${rssName} (${source.link}) has been delegated to custom schedule ${schedule.name} by keywords`)
        })
      }

      sourceScheduleName = assignedSchedules.getScheduleName(rssName)
      if (!sourceScheduleName) assignedSchedules.setScheduleName(rssName, 'default')
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
