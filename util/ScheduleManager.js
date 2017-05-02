const storage = require('./storage.js')
const feedTracker = storage.feedTracker // Directory of all feeds, used to track between multiple feed schedules
const FeedSchedule = require('./FeedSchedule.js')
const sendToDiscord = require('./sendToDiscord.js')
const debugFeeds = require('./debugFeeds.js').list
const fs = require('fs')

module.exports = function(bot) {
  const scheduleList = []
  let feedSchedulesFinished = 0

  function startSchedules() {
    scheduleList.push(new FeedSchedule(bot, listenToArticles, {name: 'default'}))
    fs.readdir('./schedules', function(err, schedules) {
      if (err || schedules.length === 0 || schedules.length === 1 && schedules[0] === 'exampleSchedule.json') return;
      for (var a in schedules) {
        fs.readFile(`./schedules/${schedules[a]}`, function(err, data) {
          if (err) throw new Error(`Could not read schedule named '${schedules[a]}'`);
          let scheduleData
          try {
            scheduleData = JSON.parse(data)
          }
          catch(e) {
            console.log(`Schedule named '${schedules[a]}' is improperly configured.\n`);
            throw e;
          }
          if (!scheduleData || !scheduleData.refreshTimeMinutes || typeof scheduleData.keywords !== 'object' || !scheduleData.keywords.length || scheduleData.keywords.length === 0) throw new Error(`Schedule named '${schedules[a]}' is improperly configured. keywords/refreshTimeMinutes are missing.`);

          scheduleData.name = schedules[a].replace(/\.json/gi, '');
          scheduleList.push(new FeedSchedule(bot, listenToArticles, scheduleData))
        })
      }
    })
  }

  function listenToArticles(articleTracker) {
    articleTracker.on('article', function(article) { // New articles are sent as the raw object directly from feedparser
      if (debugFeeds.includes(article.rssName)) console.log(`DEBUG ${article.rssName}: Invoking sendToDiscord function`);
      sendToDiscord(article.rssName, article.discordChannel, article, function(err) {
        if (err) console.log(err);
      });
    })
  }

  this.stopSchedules = function() {
    for (var i in scheduleList) {
      scheduleList[i].stop();
    }
    scheduleList = []
  }


  this.cyclesInProgress = function() {
    for (var cycle in scheduleList) {
      if (scheduleList[cycle].inProgress) return true;
    }
    return false;
  }

  startSchedules()
}
