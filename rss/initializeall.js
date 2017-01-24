/*
    This is used every time the bot is started
    if there are any enabled feeds. If there are
    no enabled feeds, it will start rss.js
    immediately through server.js.

    The process is:
    1. Retrieve the feed through request
    2. Feedparser sends the feed into an array
    3. Connect to SQL database
    4. Check if table for feed exists

      If table exists:
      5. Filter feed items by maxAge
      6. Send filtered feed items to be checked in table

          If filtered items seen in table
          7. gatherResults() (keep track of processed items)

          If filtered items not seen in table
          8. Send to Discord
          9. Log in table
          10. gatherResults()

      If table doesn't exist:
      6. Create table for feed for that Discord channel
      7. Log all items in feed in table
      8. gatherResults() and close connection
*/
const rssConfig = require('../config.json')
const requestStream = require('./request.js')
const FeedParser = require('feedparser');
const translator = require('./translator/translate.js')
const startFeedSchedule = require('../util/startFeedSchedule.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const fs = require('fs')

function isEmptyObject(obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}

module.exports = function (con, channel, rssIndex, callback) {

  var feedparser = new FeedParser()
  var currentFeed = []

  var guild = require(`../sources/${channel.guild.id}.json`)
  var rssList = guild.sources

  requestStream(rssList[rssIndex].link, feedparser, con, function () {
    callback()
    feedparser.removeAllListeners('end')
  })

  feedparser.on('error', function (error) {
    console.log(`RSS Parsing Error: (${guild.id}, ${guild.name}) => ${error}`)
    feedparser.removeAllListeners('end')
    callback()
    });

  feedparser.on('readable',function () {
    var stream = this;
    var item;

    while (item = stream.read()) {
      currentFeed.push(item);
    }
});

  feedparser.on('end', function() {
    if (currentFeed.length == 0 || rssList[rssIndex] == null) return callback();

    var feedName = rssList[rssIndex].name
    var tableAlreadyExisted = 0

    var processedItems = 0

    //var for when table doesn't exist
    var totalItems = currentFeed.length

    //var for when table exists
    var filteredItems = 0;

    console.log(`RSS Info: (${guild.id}, ${guild.name}) => Starting default initializion for: ${feedName}`)

    function startDataProcessing() {
      checkTableExists()
    }

    function checkTableExists() {
      sqlCmds.selectTable(con, feedName, function (err, results) {
        if (err) throw err;
        if (isEmptyObject(results)) {
          console.log(`RSS Info: Table does not exist for ${feedName}, creating now and initializing all`);
          createTable();
        }
        else {
          //console.log(`RSS Info: Table already exists for ${feedName}, getting new feeds if exists`)
          tableAlreadyExisted = true;

          let feedLength = currentFeed.length - 1;
          for (var x = feedLength; x >= 0; x--){ //get feeds starting from oldest, ending with newest.
            var cutoffDay;
            if (rssList[rssIndex].maxAge == null || rssList[rssIndex].maxAge == "")
              cutoffDay = new Date(new Date().setDate(new Date().getDate()-rssConfig.defaultMaxAge));
            else cutoffDay = new Date(new Date().setDate(new Date().getDate()-rssList[rssIndex].maxAge))

            if (currentFeed[x].pubdate >= cutoffDay){
              checkTable(currentFeed[x].guid, currentFeed[x]); // .guid is the feed item for the table entry, the second param is the info needed to send the actual message
            }
            else if (currentFeed[x].pubdate < cutoffDay){
              gatherResults();
            }
            else if (x == 0 && filteredItems == 0) { //when no feed items have been sent to checkTable and the foor loop is at its end
              filteredItems++;
              gatherResults();
            }
          }
        }
      })
    }

    function createTable() {
      sqlCmds.createTable(con, feedName, function (err, results) {
        if (err) throw err;
        for (var x in currentFeed){
          insertIntoTable(currentFeed[x].guid)
        }
      })
    }

    function checkTable(data, feed) {
      sqlCmds.select(con, feedName, data, function (err, results) {
        if (err) throw err;
        if (!isEmptyObject(results)) gatherResults();
        else {
          if (rssConfig.sendOldMessages == true) { //this can result in great spam once the loads up after a period of downtime
            var message = translator(channel, rssList, rssIndex, feed, false);
            //console.log(`RSS Delivery: (${guild.id}, ${guild.name}) => Never seen ${feed.link}, logging and sending msg now`);
            if (message.embedMsg != null) {
              channel.sendMessage(message.textMsg,message.embedMsg)
              .then(m => console.log(`RSS Delivery: (${guild.id}, ${guild.name}) => Never seen ${feed.link}, sending message for RSS named "${rssList[rssIndex].name}".`))
              .catch(err => {
                console.log(`RSS Delivery Error: (${guild.id}, ${guild.name}) => channel (${message.channel.id}, ${message.channel.name}) => Reason: ${err.response.body.message}`);
                // console.log(message.textMsg);
                // console.log(message.embedMsg);
                // console.log(`Channel is: `, channel);
              });
            }
            else {
              channel.sendMessage(message.textMsg)
              .then(m => console.log(`RSS Delivery: (${guild.id}, ${guild.name}) => Never seen ${feed.link}, sending message for RSS named "${rssList[rssIndex].name}".`))
              .catch(err => {
                console.log(`RSS Delivery Error: (${guild.id}, ${guild.name}) => channel (${message.channel.id}, ${message.channel.name}) => Reason: ${err.response.body.message}`);
                // console.log(message.textMsg);
                // console.log(`Channel is: `, channel);
              });
            }
          }
          insertIntoTable(data);
        }
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
        callback(con);
        //console.log(`RSS Info: (${guild.id}, ${guild.name}) => Finished default initialization for: ${feedName}`)
      }
    }

    startDataProcessing()
  });
}
