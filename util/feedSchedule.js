const fs = require('fs')
const getArticles = require('../rss/rss.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const config = require('../config.json')
const guildStorage = require('./guildStorage.js')
const currentGuilds = guildStorage.currentGuilds // Directory of guild profiles (Map)
const changedGuilds = guildStorage.changedGuilds // Directory of changed guilds profiles sent from child process (Map)
const deletedGuilds = guildStorage.deletedGuilds // Directory of deleted guild IDs (array)
const debugFeeds = require('../util/debugFeeds').list
const events = require('events')
var timer

module.exports = function(bot, callback) {
  this.cycle = new events.EventEmitter()
  const sourceList = new Map()
  const modSourceList = new Map()
  const batchSize = (config.advanced && config.advanced.batchSize) ? config.advanced.batchSize : 400
  let regBatchList = []
  let modBatchList = []
  let cycleInProgress = this.inProgress
  let cycle = this.cycle
  let feedsProcessed = 0
  let feedsSkipped = 0
  let con
  let startTime

  function genBatchLists() { // Each batch is a bunch of links. Too many links at once will cause request failures.
    let batch = new Map()

    sourceList.forEach(function(rssList, link) { // rssList per link
      if (batch.size >= batchSize) {
        regBatchList.push(batch);
        batch = new Map();
      }
      batch.set(link, rssList)
    })

    if (batch.size > 0) regBatchList.push(batch);

    batch = new Map()

    modSourceList.forEach(function(source, link) { // One RSS source per link instead of an rssList
      if (batch.size >= batchSize) {
        modBatchList.push(batch);
        batch = new Map();
      }
      batch.set(link, source)
    })

    if (batch.size > 0) modBatchList.push(batch);
  }


  function addToSourceLists(guildRss) { // rssList is an object per guildRss
    let rssList = guildRss.sources
    for (var rssName in rssList) {
      if (rssList[rssName].advanced && rssList[rssName].advanced.size() > 0) { // Special source list for feeds with unique settings defined
        let linkList = {};
        linkList[rssName] = rssList[rssName];
        modSourceList.set(rssList[rssName].link, linkList);
      }
      else if (sourceList.has(rssList[rssName].link)) {
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
    regBatchList = []
    modBatchList = []
    feedsProcessed = feedsSkipped = 0

    modSourceList.clear() // Regenerate source lists on every cycle to account for changes to guilds
    sourceList.clear()
    currentGuilds.forEach(addToSourceLists)
    genBatchLists()

    if (sourceList.size + modSourceList.size === 0) {
      cycleInProgress = false;
      return console.log(`RSS Info: Finished feed retrieval cycle. No feeds to retrieve.`);
    }
    con = sqlConnect(function() {
      getBatch(0, regBatchList, 'regular')
    });
  }


  function getBatch(batchNumber, batchList, type) {
    if (batchList.length === 0) return getBatch(0, modBatchList, 'modded');
    let completedLinks = 0
    let currentBatch = batchList[batchNumber]
    // console.log(`Starting ${type} batch #${batchNumber + 1}\n`)
    currentBatch.forEach(function(rssList, link) {

      var uniqueSettings = undefined
      if (type === 'modded') {
        for (var mod_rssName in rssList) {
          if (rssList[mod_rssName].advanced && rssList[mod_rssName].advanced.size() > 0) {
            uniqueSettings = rssList[mod_rssName].advanced;
          }
        }
      }

      getArticles(con, bot, link, rssList, uniqueSettings, function(completedLink, article) {

        if (article) {
          if (debugFeeds.includes(article.rssName)) console.log(`DEBUG ${article.rssName}: Emitted article event.`);
          cycle.emit('article', article);
        }
        if (!completedLink) return;

        completedLinks++
        if (completedLinks === currentBatch.size) {
          if (batchNumber !== batchList.length - 1) setTimeout(getBatch, 200, batchNumber + 1, batchList, type);
          else if (type === 'regular' && modBatchList.length > 0) setTimeout(getBatch, 200, 0, modBatchList, 'modded');
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
  connect()
  this.start()
  callback(this.cycle)
  return this
}
