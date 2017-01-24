/*
    This is used after initialization for all feeds on first startup.
    The main RSS file that is looping.

    The steps are nearly the same except that this is on a loop, and
    there is no filtering because all unseen data by checkTable is,
    by default, new data because it is on a loop.

    It still has to check the table however because the feedparser
    grabs ALL the data each time, new and old, through the link.
*/
const fileOps = require('../util/updateJSON.js')
const FeedParser = require('feedparser');
const requestStream = require('./request.js')
const translator = require('./translator/translate.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')

function isEmptyObject(obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}

module.exports = function (con, channel, rssIndex, sendingTestMessage, callback) {

  var feedparser = new FeedParser()
  var currentFeed = []

  var guild = require(`../sources/${channel.guild.id}.json`)
  var rssList = guild.sources

  requestStream(rssList[rssIndex].link, feedparser, con, function() {
    callback()
    feedparser.removeAllListeners('end')
  })

  feedparser.on('error', function (error) {
    console.log(`RSS Parsing Error: (${guild.id}, ${guild.name}) => ${error}, for link ${rssList[rssIndex].link}`)
    feedparser.removeAllListeners('end')
    return callback()
  });

  feedparser.on('readable',function () {
    var stream = this;
    var item;

    while (item = stream.read()) {
      currentFeed.push(item);
    }
});

  feedparser.on('end', function() {
    //sometimes feeds get deleted mid-retrieval process
    if (rssList[rssIndex] == null) return callback();
    if (currentFeed.length == 0) {
      if (sendingTestMessage) {
        callback();
        console.log(`RSS Info: (${guild.id}, ${guild.name}) => "${rssList[rssIndex].name}" has no feeds to send for rsstest.`);
        return channel.sendMessage(`Feed "${rssList[rssIndex].link}" has no available RSS that can be sent.`);
      }
      else return callback();
    }

    if (guild.name !== channel.guild.name) {
      console.log(`Guild Info: (${guild.id}, ${guild.name}) => Name change detected, changing guild name from "${guild.name}" to "${channel.guild.name}".`);
      guild.name = channel.guild.name;
      fileOps.updateFile(`./sources/${channel.guild.id}.json`, guild, `../sources/${channel.guild.id}.json`);
    }

    let feedName = rssList[rssIndex].name
    var processedItems = 0
    var filteredItems = 0
    //console.log("RSS Info: Starting retrieval for: " + feedName);

    function startDataProcessing() {
      createTable();
    }

    function createTable() {
      sqlCmds.createTable(con, feedName, function (err, rows) {
        if (err) throw err;
        if (sendingTestMessage) {
          let randFeedIndex = Math.floor(Math.random() * (currentFeed.length - 1))
          checkTable(currentFeed[randFeedIndex].guid, currentFeed[randFeedIndex]);
        }
        else {
          let feedLength = currentFeed.length - 1
          for (var x = feedLength; x >= 0; x--){ //get feeds starting from oldest, ending with newest.
            checkTable(currentFeed[x].guid, currentFeed[x]); // .guid is the feed item for the table entry, the second param is the info needed to send the actual message
            filteredItems++;
          }
        }
      })
    }

    function checkTable(data, feed) {
      if (sendingTestMessage) {
        filteredItems++;
        gatherResults();
        var message = translator(channel, rssList, rssIndex, feed, true);
        //console.log(`RSS Test Delivery: (${guild.id}, ${guild.name}) => Sending test message for: ${rssList[rssIndex].name}`);
        if (message.embedMsg != null) {
          channel.sendMessage(message.textMsg,message.embedMsg)
          .then(m => console.log(`RSS Test Delivery: (${guild.id}, ${guild.name}) => Sending test message for: ${rssList[rssIndex].name}`))
          .catch(err => console.log(`RSS Test Error: (${guild.id}, ${guild.name}) => channel (${message.channel.id}, ${message.channel.name}) => Reason: ${err.response.body.message}`));
        }

        else {
          channel.sendMessage(message.textMsg)
          .then(m => console.log(`RSS Test Delivery: (${guild.id}, ${guild.name}) => Sending test message for: ${rssList[rssIndex].name}`))
          .catch(err => console.log(`RSS Test Error: (${guild.id}, ${guild.name}) => channel (${message.channel.id}, ${message.channel.name}) => Reason: ${err.response.body.message}`));
          channel.stopTyping();
        }
      }
      else {
        sqlCmds.select(con, feedName, data, function (err, results, fields) {
          if (err) throw err;
          if (!isEmptyObject(results)) {
            //console.log(`already seen ${feed.link}, not logging`);
            gatherResults();
          }
          else {
            var message = translator(channel, rssList, rssIndex, feed, false);
            if (message != null) {
              //console.log(`RSS Delivery: (${guild.id}, ${guild.name}) => Never seen ${feed.link}, sending message for RSS named "${rssList[rssIndex].name}".`);
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
    }


    function insertIntoTable(data) { //inserting the feed into the table marks it as "seen"
      sqlCmds.insert(con, feedName, data, function (err,res) {
        if (err) throw err;
        gatherResults();
      })
    }

    function gatherResults(){
      processedItems++;
      //console.log(`${rssList[rssIndex].name} ${filteredItems} ${processedItems}`) //for debugging
      if (processedItems == filteredItems) {
        callback();
      }
    }

    startDataProcessing();
  });
}
