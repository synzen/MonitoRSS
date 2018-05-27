const config = require('../config.json')
const FeedSchedule = require('./FeedSchedule.js')
const debugFeeds = require('./debugFeeds.js').list
const queueArticle = require('./queueArticle.js')
const fs = require('fs')
const storage = require('./storage.js')
const log = require('./logger.js')

class ScheduleManager {
  constructor (bot) {
    this.bot = bot
    this.scheduleList = []
    storage.scheduleManager = this

    this.scheduleList.push(new FeedSchedule(this.bot, { name: 'default' }))
    fs.readdir('./settings/schedules', (err, schedules) => {
      if (err || schedules.length === 0 || (schedules.length === 1 && schedules[0] === 'exampleSchedule.json')) return
      schedules.forEach(schedule => {
        if (schedule !== 'exampleSchedule.json') {
          let scheduleData
          try {
            scheduleData = JSON.parse(fs.readFileSync(`./settings/schedules/${schedule}`))
          } catch (e) {
            log.general.error(`Schedule named '${schedule}' is improperly configured\n`)
            throw e
          }
          if (!scheduleData || !scheduleData.refreshTimeMinutes || typeof scheduleData.keywords !== 'object' || !scheduleData.keywords.length || scheduleData.keywords.length === 0) throw new Error(`Schedule named '${schedule}' is improperly configured. keywords/refreshTimeMinutes are missing.`)

          scheduleData.name = schedule.replace(/\.json/gi, '')
          this.scheduleList.push(new FeedSchedule(this.bot, scheduleData))
        }
      })
    })

    this.scheduleList.forEach(schedule => this._listenToArticles(schedule.cycle))
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
