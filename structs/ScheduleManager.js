const config = require('../config.json')
const FeedSchedule = require('./FeedSchedule.js')
const debugFeeds = require('../util/debugFeeds.js').list
const queueArticle = require('../util/queueArticle.js')
const storage = require('../util/storage.js')
const log = require('../util/logger.js')

class ScheduleManager {
  constructor (bot, customSchedules, feedData) { // Third parameter is only used when config.database.uri is "memory"
    this.bot = bot
    this.scheduleList = []
    storage.scheduleManager = this
    // Set up the default schedule
    this.scheduleList.push(new FeedSchedule(this.bot, { name: 'default' }, feedData))
    // Set up custom schedules
    if (customSchedules) for (var i = 0; i < customSchedules.length; ++i) this.scheduleList.push(new FeedSchedule(this.bot, customSchedules[i]))
    for (var j = 0; j < this.scheduleList.length; ++j) this._listenToArticles(this.scheduleList[j].cycle)
  }

  _listenToArticles (articleTracker) {
    articleTracker.on('article', article => { // New articles are sent as the raw object directly from feedparser
      if (debugFeeds.includes(article.rssName)) log.debug.info(`${article.rssName} ScheduleManager queueing article ${article.link} to send`)
      queueArticle(article, err => {
        if (err && config.log.linkErrs === true) {
          const channel = this.bot.channels.get(article.discordChannelId)
          log.general.warning(`Failed to send article ${article.link}`, channel.guild, channel, err)
          if (err.code === 50035) channel.send(`Failed to send formatted article for article <${article.link}> due to misformation.\`\`\`${err.message}\`\`\``).catch(err => log.general.warning(`Unable to send failed-to-send message for article`, err))
        }
      })
    })
  }

  run (refreshTime) { // Run schedules with respect to their refresh times
    this.scheduleList.forEach(schedule => {
      if (schedule.refreshTime === refreshTime) schedule.run()
    })
  }

  stopSchedules () {
    this.scheduleList.forEach(schedule => schedule.stop())
    this.scheduleList.length = 0
  }

  cyclesInProgress () {
    for (var cycle = 0; cycle < this.scheduleList.length; ++cycle) {
      if (this.scheduleList[cycle].inProgress) return true
    }
    return false
  }
}

module.exports = ScheduleManager
