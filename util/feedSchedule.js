const fs = require('fs')
const getArticles = require('../rss/rss.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const config = require('../config.json')
const guildStorage = require('./guildStorage.js')
const currentGuilds = guildStorage.currentGuilds // Directory of guild profiles (Map)
const changedGuilds = guildStorage.changedGuilds // Directory of changed guilds profiles sent from child process (Map)
const deletedGuilds = guildStorage.deletedGuilds // Directory of deleted guild IDs (array)
const sourceList = guildStorage.sourceList // Directory of links to be requested on each cycle (Map)
const debugFeeds = require('../util/debugFeeds').list
const events = require('events')
var timer

module.exports = function(bot, callback) {
  this.cycle = new events.EventEmitter()
  const sourceList = new Map()
  const batchSize = (config.advanced && config.advanced.batchSize) ? config.advanced.batchSize : 400
  let batchList = []
  let cycleInProgress = this.inProgress
  let cycle = this.cycle
  let totalFeeds = 0
  let feedsProcessed = 0
  let feedsSkipped = 0
  let con
  let startTime

  function genBatchList() { // Each batch is a bunch of links. Too many links at once will cause request failures.
    let batch = new Map()

    sourceList.forEach(function(rssList, link) { // rssList per link
      if (batch.size >= batchSize) {
        batchList.push(batch);
        batch = new Map();
      }
      batch.set(link, rssList)
    })

    batchList.push(batch)
  }


  function addToSourceList(guildRss) { // rssList is an object per guildRss
    let rssList = guildRss.sources
    for (var rssName in rssList) {
      totalFeeds++;
      if (sourceList.has(rssList[rssName].link)) {
        let linkList = sourceList.get(rssList[rssName].link);
        linkList[rssName] = rssList[rssName];
      }
      else {
        let linkList = {};
        linkList[rssName] = rssList[rssName];
        sourceList.set(rssList[rssName].link, linkList);
      }
    }
  }


  function checkGuildChanges() { // Check for any guilds profiles waiting to be updated
    for (var index in deletedGuilds) { // Get rid of deleted guild profiles
      const guildId = deletedGuilds[index];
      if (currentGuilds.has(guildId)) {
        currentGuilds.delete(guildId);
        console.log(`RSS Module deleted profile for guild ID: ${guildId}`);
      }
      deletedGuilds.splice(index, 1);
      if (changedGuilds.get(guildId)) delete changedGuilds.delete(guildId); // Changed profile is useless now that the guild is deleted
    }

    changedGuilds.forEach(function(guildRss, guildId) { // Check for guilds to be updated that were sent from child process
      currentGuilds.set(guildId, guildRss)
      changedGuilds.delete(guildId)
      console.log('RSS Module updated profile for guild ID: ' + guildId)
    })
  }


  function connect() {
    if (cycleInProgress) {
      console.log(`RSS Info: Previous cycle was unable to finish, attempting to start new cycle.`);
      return endCon(true);
    }
    startTime = new Date()

    checkGuildChanges()
    cycleInProgress = true
    batchList = []
    totalFeeds = feedsProcessed = feedsSkipped = 0

    sourceList.clear() // Regenerate source list on every cycle to account for changes to guilds
    currentGuilds.forEach(addToSourceList)

    genBatchList()

    if (totalFeeds === 0) {
      cycleInProgress = false;
      return console.log(`RSS Info: Finished feed retrieval cycle. No feeds to retrieve.`);
    }
    con = sqlConnect(getBatch);
  }


  function getBatch(batchNumber) {
    if (!batchNumber) batchNumber = 0;
    let completedLinks = 0
    let currentBatch = batchList[batchNumber]
    // console.log(`Starting batch #${batchNumber}\n`)
    currentBatch.forEach(function(rssList, link) {
      getArticles(con, link, rssList, bot, function(completedLink, article) {

        if (article) {
          if (debugFeeds.includes(article.rssName)) console.log(`DEBUG ${article.rssName}: Emitted article event.`);
          cycle.emit('article', article);
        }
        if (!completedLink) return;
        completedLinks++;
        if (completedLinks === currentBatch.size) {
          if (batchNumber !== batchList.length - 1) setTimeout(getBatch, 500, batchNumber + 1);
          else return endCon();
        }

      })
    })
  }


  function endCon(startingCycle) {
    sqlCmds.end(con, function(err) { // End SQL connection
      if (err) console.log('Error: Could not close SQL connection. ' + err)
      cycleInProgress = false
      if (startingCycle) return connect();
      var timeTaken = ((new Date() - startTime) / 1000).toFixed(2)
      console.log(`RSS Info: Finished feed retrieval cycle. Cycle Time: ${timeTaken}s`)
    }, startingCycle);
  }


  this.start = function() {
    let refreshTime = (config.feedSettings.refreshTimeMinutes) ? config.feedSettings.refreshTimeMinutes : 15;
    timer = setInterval(connect, refreshTime*60000)
  }

  this.stop = function() {
    clearInterval(timer)
  }

  this.start()
  callback(this.cycle)
  return this
}
