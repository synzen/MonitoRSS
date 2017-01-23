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
const requestStream = require('./request.js')
const FeedParser = require('feedparser');
const fileOps = require('../util/updateJSON.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const startFeedSchedule = require('../util/startFeedSchedule.js')
const fs = require('fs')

function isEmptyObject(obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}

module.exports = function (con, rssLink, channel, callback) {

  var feedparser = new FeedParser()
  var currentFeed = []

  requestStream(rssLink, feedparser, con, function() {
    callback()
    feedparser.removeAllListeners('end')
  })

  feedparser.on('error', function (error) {
    channel.sendMessage(`<${rssLink}> is not a valid feed to add.`)
    console.log(`RSS Warning: ${rssLink} is not a valid feed to add.`)
    channel.stopTyping()
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
    var metaLink = ""
    var randomNum = Math.floor((Math.random() * 100) + 1)
    if (currentFeed[0] != null) metaLink = currentFeed[0].meta.link;

    var feedName = `${channel.id}_${randomNum}${metaLink}`

    if (metaLink == "" ) {
      channel.sendMessage("Cannot find meta link for this feed. Unable to add to database. This is most likely due to no existing articles in the feed.");
      console.log(`RSS Info: (${channel.guild.id}, ${channel.guild.name}) => Cannot initialize feed because of no meta link: ${rssLink}`)
      channel.stopTyping();
      return callback();
    }

    //MySQL table names have a limit of 64 char
    if (feedName.length >= 64 ) feedName = feedName.substr(0,64);
    feedName = feedName.replace(/\?/g, "")


    var processedItems = 0
    var totalItems = currentFeed.length

    console.log(`RSS Info: (${channel.guild.id}, ${channel.guild.name}) => Initializing new feed: ${rssLink}`)

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
        callback();
      }
    }

    function addToConfig() {
      if (currentFeed[0].meta.title == null || currentFeed[0].meta.title == "") var metaTitle = "No feed title found.";
      else var metaTitle = currentFeed[0].meta.title;

      if (currentFeed[0].guid.startsWith("yt:video")) metaTitle = `Youtube - ${currentFeed[0].meta.title}`;
      else if (currentFeed[0].meta.link.includes("reddit")) metaTitle = `Reddit - ${currentFeed[0].meta.title}`;

      if (fs.existsSync(`./sources/${channel.guild.id}.json`)) {
        var guildRSS = require(`../sources/${channel.guild.id}.json`);
        var rssList = guildRSS.sources;
        rssList.push({
      		enabled: 1,
      		name: feedName,
          title: metaTitle,
      		link: rssLink,
      		channel: channel.id
      	});
      }
      else {
        var guildRSS = {
          name: channel.guild.name,
          id: channel.guild.id,
          sources: [{
        		enabled: 1,
        		name: feedName,
            title: metaTitle,
        		link: rssLink,
        		channel: channel.id
        	}]
        };
      }

      // try {
      //   delete require.cache[require.resolve(`../sources/${channel.guild.id}.json`)]
      // }
      // catch (e) {}
      fileOps.updateFile(`./sources/${channel.guild.id}.json`, guildRSS, `../sources/${channel.guild.id}.json`)
      console.log("RSS Info: Successfully added new feed.")
      channel.sendMessage(`Successfully added <${rssLink}> for this channel.`)
      channel.stopTyping()
    }

    startDataProcessing();
  });

}
