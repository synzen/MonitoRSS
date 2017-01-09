/*
    This is only used when adding new feeds through Discord channels.

    The process is:
    1. Retrieve the feed through request
    2. Feedparser sends the feed into an array
    3. Connect to SQL database
    4. Create table for feed for that Discord channel
    7. Log all current feed items in table
    8. gatherResults() and close connection
    9. Add to config
*/

const request = require('request');
const FeedParser = require('feedparser');
const updateConfig = require('../util/updateJSON.js')
const requestStream = require('./request.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const startFeedSchedule = require('../util/startFeedSchedule.js')

function isEmptyObject(obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}

module.exports = function (bot, rssLink, channel) {
  var rssConfig = require('../config.json')
  var rssList = rssConfig.sources

  var feedparser = new FeedParser()
  var currentFeed = []

  requestStream(rssLink, feedparser)

  feedparser.on('error', function (error) {
    channel.sendMessage("Not a proper feed.");
    console.log("not a feed")
    feedparser.removeAllListeners('end');
  });

  feedparser.on('readable',function () {
    var stream = this;
    var item;

    while (item = stream.read()) {
      currentFeed.push(item);
    }
});

  feedparser.on('end', function() {
    let feedName = `${channel.id}_${currentFeed[0].meta.link}`
    var processedItems = 0;
    var totalItems = currentFeed.length;
    var con;

    console.log("RSS Info: Initializing new feed: " + rssLink)

    function startDataProcessing() {
      con = sqlConnect(createTable)
      if (con == null) throw "RSS ERROR: SQL type is not correctly defined in config"
    }

    function createTable() {
      sqlCmds.createTable(con, feedName, function (err, rows) {
        if (err) throw err;
        for (var x in currentFeed){
          checkTable(currentFeed[x].guid)
        }
      })
    }

    function checkTable(data) {
      sqlCmds.select(con, feedName, data, function (err, results, fields) {
        if (err) throw err;
        insertIntoTable(data);
      })
    }

    function insertIntoTable(data) {
      sqlCmds.insert(con, feedName, data, function (err, res){
        if (err) throw err;
        gatherResults();
      })

    }

    function gatherResults(){
      processedItems++;
      if (processedItems == totalItems) {
        addToConfig();
        return sqlCmds.end(con, function(err) {
          if (err) throw err;
          else console.log(`RSS Info: Successfully added ${rssLink} to config for channel ${channel.id}.`);
        });
      }
    }

    function addToConfig(){
      rssList.push({
    		enabled: 1,
    		name: feedName,
    		link: rssLink,
    		channel: channel.id
    	})

      updateConfig('./config.json', rssConfig)
      channel.sendMessage(`Successfully added ${rssLink} to config for channel ${channel.id}.`)
    }

    startDataProcessing();
  });

}
