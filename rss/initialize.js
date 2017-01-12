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

module.exports = function (con, rssLink, channel) {
  var rssConfig = require('../config.json')
  var rssList = rssConfig.sources[channel.guild.id]

  var feedparser = new FeedParser()
  var currentFeed = []

  requestStream(rssLink, feedparser)

  feedparser.on('error', function (error) {
    channel.sendMessage(`${rssLink} is not a proper feed to add.`);
    console.log(`RSS Warning: ${rssLink} is not a proper feed to add.`)
    channel.stopTyping()
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
    let metaLink = currentFeed[0].meta.link
    var feedName = `${channel.id}_${currentFeed[0].meta.link}`

    //MySQL table names have a limit of 64 char
    if (feedName.length >= 64 ) feedName = feedName.substr(0,64);
    // if (metaLink.slice(0,10) == "http://www") feedNamePart = metaLink.slice(10, metaLink.length);
    // else if (metaLink.slice(0,11) == "https://www") feedNamePart = metaLink.slice(11, metaLink.length);
    // else feedNamePart = metaLink.slice(7, metaLink.length);


    var processedItems = 0
    var totalItems = currentFeed.length

    console.log("RSS Info: Initializing new feed: " + rssLink)

    function startDataProcessing() {
      createTable()
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

    function addToConfig() {

      rssList.push({
    		enabled: 1,
    		name: feedName,
    		link: rssLink,
    		channel: channel.id
    	})

      updateConfig('./config.json', rssConfig)
      channel.sendMessage(`Successfully added ${rssLink} for this channel.`)
      channel.stopTyping()
    }

    startDataProcessing();
  });

}
