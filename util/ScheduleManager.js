const config = require('../config.json')
const FeedSchedule = require('./FeedSchedule.js')
const sendToDiscord = require('./sendToDiscord.js')
const debugFeeds = require('./debugFeeds.js').list
const fs = require('fs')
const storage = require('./storage.js')

class ScheduleManager {
  constructor (bot) {
    this.bot = bot
    this.scheduleList = []
    storage.scheduleManager = this

    this.scheduleList.push(new FeedSchedule(this.bot, {name: 'default'}))
    fs.readdir('./settings/schedules', (err, schedules) => {
      if (err || schedules.length === 0 || (schedules.length === 1 && schedules[0] === 'exampleSchedule.json')) return
      schedules.forEach(schedule => {
        if (schedule !== 'exampleSchedule.json') {
          let scheduleData
          try {
            scheduleData = JSON.parse(fs.readFileSync(`./settings/schedules/${schedule}`))
          } catch (e) {
            console.log(`Schedule named '${schedule}' is improperly configured.\n`)
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
      if (debugFeeds.includes(article.rssName)) console.log(`DEBUG ${article.rssName}: Invoking sendToDiscord function`)
      sendToDiscord(this.bot, article, err => {
        if (err && config.logging.showLinkErrs === true) {
          const channel = this.bot.channels.get(article.discordChannelId)
          console.log(`RSS Delivery Failure: (${channel.guild.id}, ${channel.guild.name}) => channel (${channel.id}, ${channel.name}) for article ${article.link}`, err.message || err)
          if (err.code === 50035) channel.send(`Failed to send formatted article for article <${article.link}> due to misformation.\`\`\`${err.message}\`\`\``).catch(err => console.log(`ScheduleManager Warning: Unable to send failed message for article:`, err.message || err))
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
