const config = require('../config.json')
const FeedSchedule = require('./FeedSchedule.js')
const sendToDiscord = require('./sendToDiscord.js')
const debugFeeds = require('./debugFeeds.js').list
const fs = require('fs')
const storage = require('./storage.js')

module.exports = function (bot) {
  let scheduleList = []

  function startSchedules () {
    scheduleList.push(new FeedSchedule(bot, listenToArticles, {name: 'default'}))
    fs.readdir('./settings/schedules', function (err, schedules) {
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
          scheduleList.push(new FeedSchedule(bot, listenToArticles, scheduleData))
        }
      })
    })
  }

  function listenToArticles (articleTracker) {
    articleTracker.on('article', function (article) { // New articles are sent as the raw object directly from feedparser
      if (debugFeeds.includes(article.rssName)) console.log(`DEBUG ${article.rssName}: Invoking sendToDiscord function`)
      sendToDiscord(bot, article, function (err) {
        if (err && config.logging.showLinkErrs === true) {
          const channel = bot.channels.get(article.discordChannelId)
          console.log(`RSS Delivery Failure: (${channel.guild.id}, ${channel.guild.name}) => channel (${channel.id}, ${channel.name}) for article ${article.link}`, err.message || err)
          if (err.code === 50035) channel.send(`Failed to send formatted article for article <${article.link}> due to misformation.\`\`\`${err.message}\`\`\``)
        }
      })
    })
  }

  this.run = function (refreshTime) { // Run schedules with respect to their refresh times
    scheduleList.forEach(schedule => {
      if (schedule.refreshTime === refreshTime) schedule.run()
    })
  }

  this.stopSchedules = function () {
    scheduleList.forEach(schedule => schedule.stop())
    scheduleList.length = 0
  }

  this.startSchedules = startSchedules

  this.cyclesInProgress = function () {
    for (var cycle = 0; cycle < scheduleList.length; ++cycle) {
      if (scheduleList[cycle].inProgress) return true
    }
    return false
  }

  storage.scheduleManager = this
  startSchedules()
}
