const fs = require('fs')
const config = require('../config.json')
const initAll = require('../rss/initializeall.js')
const storage = require('./storage.js')
const currentGuilds = storage.currentGuilds // Directory of guild profiles (Map)
const feedTracker = storage.feedTracker // Directory of all feeds, used to track between multiple feed schedules
const allScheduleWords = storage.allScheduleWords // Directory of all words defined across all schedules
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fileOps = require('./fileOps.js')

module.exports = function(bot, callback) {
  try {
    var scheduleWordDir = {}
    const schedules = fs.readdirSync('./schedules') // Record all words in schedules for later use by FeedSchedules
    if (schedules.length === 1 && schedules[0] === 'exampleSchedule.json') console.log('No custom schedules detected.');
    for (var i in schedules) {
      if (schedules[i] !== 'exampleSchedule.json') {
        const schedule = JSON.parse(fs.readFileSync(`./schedules/${schedules[i]}`));
        if (!schedule.refreshTimeMinutes || typeof schedule.keywords !== 'object' || !schedule.keywords.length || schedule.keywords.length === 0) throw new Error(`Schedule named '${schedules[i]}' is improperly configured.`);

        const scheduleName = schedules[i].replace(/\.json/gi, '');

        scheduleWordDir[scheduleName] = [];
        const keywords = schedule.keywords;
        for (var x in keywords) {
          allScheduleWords.push(keywords[x]);
          scheduleWordDir[scheduleName].push(keywords[x]);
        }
      }
    }
  }
  catch(e) {}


  const guildList = []
  const modSourceList = new Map()
  const sourceList = new Map()
  const regBatchList = []
  const modBatchList = []
  const batchSize = (config.advanced && config.advanced.batchSize) ? config.advanced.batchSize : 400
  let skippedFeeds = 0
  let initializedFeeds = 0
  let con

  function genBatchLists() {
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

  function addToSourceLists(rssList, guildId) { // rssList is an object per guildRss
    for (var rssName in rssList) {
      rssList[rssName].guildId = guildId; // Added for debugging purposes and will not show up in files
      if (rssList[rssName].advanced && rssList[rssName].advanced.size() > 0) { // Special source list for feeds with unique settings defined, each linkList only has 1 item
        let linkList = {};
        linkList[rssName] = rssList[rssName];
        modSourceList.set(rssList[rssName].link, linkList);
      }
      else if (sourceList.has(rssList[rssName].link)) { // Regular source lists, optimized for faster operation by aggregating feeds of same links
        let linkList = sourceList.get(rssList[rssName].link);
        linkList[rssName] = rssList[rssName];
      }
      else {
        let linkList = {};
        linkList[rssName] = rssList[rssName];
        sourceList.set(rssList[rssName].link, linkList);
      }

      // Assign feeds to specific schedules in feedTracker for use by feedSchedules
      if (scheduleWordDir && scheduleWordDir.size() > 0) {
        for (var scheduleName in scheduleWordDir) {
          let wordList = scheduleWordDir[scheduleName];
          for (var i in wordList) {
            if (rssList[rssName].link.includes(wordList[i]) && !feedTracker[rssName]) {
              console.log(`INIT: Assigning feed ${rssName} to ${scheduleName}`);
              feedTracker[rssName] = scheduleName; // Assign a schedule to a feed if it doesn't already exist in the feedTracker to another schedule
            }
          }
        }
        if (!feedTracker[rssName]) feedTracker[rssName] = 'default'; // Assign to default schedule if it wasn't assigned to a custom schedule
      }


    }
  }

  function addGuildRss(guildFile) {
    const guildId = guildFile.replace(/.json/g, '') // Remove .json file ending since only the ID is needed
    if (!bot.guilds.get(guildId)) { // Check if it is a valid guild in bot's guild collection
       if (guildFile === 'master.json' || guildFile === 'guild_id_here.json' || guildFile === 'backup') return;
       return console.log(`RSS Guild Profile: ${guildFile} was not found in bot's guild list. Skipping.`);
     }

    try {
      const guildRss = JSON.parse(fs.readFileSync(`./sources/${guildFile}`))
      const rssList = guildRss.sources
      if (fileOps.isEmptySources(guildRss)) return; // Skip when empty source object

      if (!currentGuilds.has(guildId) || JSON.stringify(currentGuilds.get(guildId)) !== JSON.stringify(guildRss)) {
        currentGuilds.set(guildId, guildRss);
      }
      addToSourceLists(rssList, guildId)
    }
    catch(err) {return fileOps.checkBackup(err, guildId)}
  }

  fs.readdir('./sources', function(err, files) {
    if (err) throw err;
    files.forEach(addGuildRss)
    if (sourceList.size + modSourceList.size === 0) {
      console.log('RSS Info: There are no active feeds to initialize.');
      return callback();
    }
    return connect();
  })

  function connect() {
    console.log('RSS Info: Starting initialization cycle.')
    con = sqlConnect(function(err) {
      if (err) throw new Error(`Could not connect to SQL database for initialization. (${err})`)
      genBatchLists()
      getBatch(0, regBatchList, 'regular')
    })
    if (!con) throw new Error('RSS Error: SQL type is not correctly defined in config');
  }

  function getBatch(batchNumber, batchList, type) {
    if (batchList.length === 0) return getBatch(0, modBatchList, 'modded');
    let currentBatch = batchList[batchNumber]
    let completedLinks = 0
    console.log(`Starting ${type} batch #${batchNumber + 1}`)

    currentBatch.forEach(function(rssList, link) { // rssList is an rssList of a specific link
      var uniqueSettings = undefined
      if (type === 'modded') {
        for (var mod_rssName in rssList) {
          if (rssList[mod_rssName].advanced && rssList[mod_rssName].advanced.size() > 0) {
            uniqueSettings = rssList[mod_rssName].advanced
          }
        }
      }

      initAll(bot, con, link, rssList, uniqueSettings, function(link) {
        completedLinks++
        console.log(`Progress (B${batchNumber + 1}): ${completedLinks}/${currentBatch.size}`)
        if (completedLinks === currentBatch.size) {
          if (batchNumber !== batchList.length - 1) setTimeout(getBatch, 200, batchNumber + 1, batchList, type);
          else if (type === 'regular' && modBatchList.length > 0) setTimeout(getBatch, 200, 0, modBatchList, 'modded');
          else return endCon();
        }
      })
    })
  }

  function endCon() {
    sqlCmds.end(con, function(err) {
      console.log('INIT Info: Finished initialization cycle.')
    })
    callback()
  }

}
