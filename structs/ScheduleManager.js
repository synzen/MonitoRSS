const config = require('../config.json')
const FeedSchedule = require('./FeedSchedule.js')
const debugFeeds = require('../util/debugFeeds.js').list
const ArticleMessageQueue = require('./ArticleMessageQueue.js')
// const queueArticle = require('../util/queueArticle.js')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')

class ScheduleManager {
  constructor (bot, customSchedules, feedData) { // Third parameter is only used when config.database.uri is a databaseless folder path
    this.bot = bot
    this.articleMessageQueue = new ArticleMessageQueue()
    this.scheduleList = []
    storage.scheduleManager = this
    // Set up the default schedule
    this.scheduleList.push(new FeedSchedule(this.bot, { name: 'default', refreshTimeMinutes: config.feeds.refreshTimeMinutes }, feedData))
    // Set up custom schedules
    if (customSchedules) for (var i = 0; i < customSchedules.length; ++i) this.scheduleList.push(new FeedSchedule(this.bot, customSchedules[i]))
    for (var j = 0; j < this.scheduleList.length; ++j) {
      const cycle = this.scheduleList[j].cycle
      cycle.on('article', this._queueArticle.bind(this))
      cycle.on('finish', this._finishSchedule.bind(this))
    }
  }

  async _queueArticle (article) {
    if (debugFeeds.includes(article.rssName)) log.debug.info(`${article.rssName} ScheduleManager queueing article ${article.link} to send`)
    try {
      await this.articleMessageQueue.send(article)
    } catch (err) {
      if (config.log.linkErrs === true) {
        const channel = this.bot.channels.get(article.discordChannelId)
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
    if (!schedule.refreshTimeMinutes || !schedule.keywords) throw new TypeError('refreshTimeMinutes or keywords is missing in schedule to addSchedule')
    const feedSchedule = new FeedSchedule(storage.bot, schedule)
    this.scheduleList.push(feedSchedule)
    feedSchedule.cycle.on('article', this._queueArticle.bind(this))
    feedSchedule.cycle.on('finish', this._finishSchedule.bind(this))
    if (storage.bot.shard && storage.bot.shard.count > 0) process.send({ _drss: true, type: 'addCustomSchedule', schedule: schedule })
  }

  run (refreshTime) { // Run schedules with respect to their refresh times
    for (var x = 0; x < this.scheduleList.length; ++x) {
      const schedule = this.scheduleList[x]
      if (schedule.refreshTime === refreshTime) return schedule.run()
    }
    // If there is no schedule with that refresh time
    if (storage.bot.shard && storage.bot.shard.count > 0) process.send({ _drss: true, type: 'scheduleComplete', refreshTime: refreshTime })
  }

  stopSchedules () {
    this.scheduleList.forEach(schedule => schedule.stop())
    this.scheduleList.length = 0
  }

  cyclesInProgress (name) {
    for (var cycle = 0; cycle < this.scheduleList.length; ++cycle) {
      const feedSchedule = this.scheduleList[cycle]
      if (name && feedSchedule.schedule.name === name && feedSchedule.inProgress) return true
      else if (feedSchedule.inProgress) return true
    }
    return false
  }
}

module.exports = ScheduleManager
