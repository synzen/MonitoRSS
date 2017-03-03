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
const fileOps = require('../util/fileOps.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const startFeedSchedule = require('../util/startFeedSchedule.js')

module.exports = function(con, rssLink, channel, callback) {

  var feedparser = new FeedParser()
  var currentFeed = []

  requestStream(rssLink, feedparser, function(err) {
    if (err) {
      console.log(`RSS Warning: Unable to add ${rssLink}, could not connect due to invalid response. (${err})`);
      return callback(`Unable to add <${rssLink}>, could not connect due to invalid response. Be sure to validate your feed.`);
    }
  })

  feedparser.on('error', function(err) {
    if (err)  {
      feedparser.removeAllListeners('end');
      console.log(`RSS Warning:: Unable to add ${rssLink} due to invalid feed.`);
      return callback(`Unable to add <${rssLink}>, could not validate as a proper feed.`);
    }
  });

  feedparser.on('readable', function() {
    var stream = this;
    var item;

    while (item = stream.read()) {
      currentFeed.push(item);
    }

  });

  feedparser.on('end', function() {
    var metaLink = ''
    var randomNum = Math.floor((Math.random() * 99) + 1)
    if (currentFeed[0]) metaLink = (currentFeed[0].meta.link != null) ? currentFeed[0].meta.link : currentFeed[0].meta.title;

    var rssName = `${channel.id}_${randomNum}${metaLink}`

    if (!metaLink) {
      channel.sendMessage("Cannot find meta link for this feed. Unable to add to database. This is most likely due to no existing articles in the feed.");
      console.log(`RSS Info: (${channel.guild.id}, ${channel.guild.name}) => Cannot initialize feed because of no meta link: ${rssLink}`)
      return callback();
    }

    // MySQL table names have a limit of 64 char
    if (rssName.length >= 64 ) rssName = rssName.substr(0,64);
    rssName = rssName.replace(/\?/g, '') // remove question marks to prevent sql from auto-escaping


    var processedItems = 0
    var totalItems = currentFeed.length

    console.log(`RSS Info: (${channel.guild.id}, ${channel.guild.name}) => Initializing new feed: ${rssLink}`)

    function getArticleId(article) {
      var equalGuids = (currentFeed.length > 1) ? true : false // default to true for most feeds
      if (equalGuids && currentFeed[0].guid) for (var x in currentFeed) {
        if (x > 0 && currentFeed[x].guid != currentFeed[x - 1].guid) equalGuids = false;
      }

      if ((!article.guid || equalGuids) && article.title) return article.title;
      if ((!article.guid || equalGuids) && !article.title && article.pubdate && article.pubdate !== "Invalid Date") return article.pubdate;
      return article.guid;
    }

    function startDataProcessing() {
      createTable()
    }

    function createTable() {
      sqlCmds.createTable(con, rssName, function (err, rows) {
        if (err) throw err;
        for (var x in currentFeed) insertIntoTable(getArticleId(currentFeed[x]));
      })
    }

    function insertIntoTable(articleId) {
      sqlCmds.insert(con, rssName, articleId, function (err, res) {
        if (err) throw err;
        gatherResults();
      })

    }

    function gatherResults() {
      processedItems++;
      if (processedItems == totalItems) addToConfig();
    }

    function addToConfig() {
      var metaTitle = (currentFeed[0].meta.title) ? currentFeed[0].meta.title : 'No feed title found.'

      if (currentFeed[0].guid && currentFeed[0].guid.startsWith("yt:video")) metaTitle = `Youtube - ${currentFeed[0].meta.title}`;
      else if (currentFeed[0].meta.link && currentFeed[0].meta.link.includes("reddit")) metaTitle = `Reddit - ${currentFeed[0].meta.title}`;

      if (fileOps.exists(`./sources/${channel.guild.id}.json`)) {
        var guildRss = require(`../sources/${channel.guild.id}.json`);
        var rssList = guildRss.sources;
        rssList[rssName] = {
      		enabled: 1,
          title: metaTitle,
      		link: rssLink,
      		channel: channel.id
      	}
      }
      else {
        var guildRss = {
          name: channel.guild.name,
          id: channel.guild.id,
          sources: {}
        };
        guildRss.sources[rssName] = {
      		enabled: 1,
          title: metaTitle,
      		link: rssLink,
      		channel: channel.id
      	}
      }

      fileOps.updateFile(channel.guild.id, guildRss, `../sources/${channel.guild.id}.json`)
      callback()

    }

    return startDataProcessing()
  });

}
