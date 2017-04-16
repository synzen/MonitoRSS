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
const startFeedSchedule = require('../util/feedSchedule.js')
const currentGuilds = require('../util/fetchInterval').currentGuilds

module.exports = function(con, rssLink, channel, callback) {

  const feedparser = new FeedParser()
  const currentFeed = []

  requestStream(rssLink, feedparser, function(err) {
    if (err) return callback({type: 'request', content: err});
  })

  feedparser.on('error', function(err) {
    if (err)  {
      feedparser.removeAllListeners('end');
      return callback({type: 'feedparser', content: err});
    }
  })

  feedparser.on('readable', function() {
    let item

    while (item = this.read()) {
      currentFeed.push(item);
    }

  })

  feedparser.on('end', function() {
    const randomNum = Math.floor((Math.random() * 99999999999) + 1)
    let metaLink = ''

    if (currentFeed[0]) metaLink = (currentFeed[0].meta.link) ? currentFeed[0].meta.link : (currentFeed[0].meta.title) ? currentFeed[0].meta.title : `random_${Math.floor((Math.random() * 99999) + 1)}`;
    else metaLink = `random_${Math.floor((Math.random() * 99999) + 1)}`;

    let rssName = `${randomNum}_${metaLink}`;

    // MySQL table names have a limit of 64 char
    if (rssName.length >= 64 ) rssName = rssName.substr(0,64);
    rssName = rssName.replace(/\?/g, '') // Remove question marks to prevent sql from auto-escaping

    const totalItems = currentFeed.length
    let processedItems = 0

    // console.log(`RSS Info: (${channel.guild.id}, ${channel.guild.name}) => Initializing new feed: ${rssLink}`)

    function getArticleId(article) {
      let equalGuids = (currentFeed.length > 1) ? true : false // default to true for most feeds
      if (equalGuids && currentFeed[0].guid) for (var x in currentFeed) {
        if (x > 0 && currentFeed[x].guid != currentFeed[x - 1].guid) equalGuids = false;
      }

      // If all articles have the same guids, fall back to title, and if no title, fall back to pubdate
      if ((!article.guid || equalGuids) && article.title) return article.title;
      if ((!article.guid || equalGuids) && !article.title && article.pubdate && article.pubdate !== "Invalid Date") return article.pubdate;
      return article.guid;
    }

    function startDataProcessing() {
      createTable()
    }

    function createTable() {
      sqlCmds.createTable(con, rssName, function(err, rows) {
        if (err) return callback({type: 'database', content: err});
        for (var x in currentFeed) {
          insertIntoTable({
            id: getArticleId(currentFeed[x]),
            title: currentFeed[x].title
          });
        }
      })
    }

    function insertIntoTable(articleInfo) {
      sqlCmds.insert(con, rssName, articleInfo, function(err, res) {
        if (err) callback({type: 'database', content: err});
        gatherResults()
      })
    }

    function gatherResults() {
      processedItems++
      if (processedItems === totalItems) addToConfig();
    }

    function addToConfig() {
      let metaTitle = (currentFeed[0].meta.title) ? currentFeed[0].meta.title : 'No feed title found.'

      if (currentFeed[0].guid && currentFeed[0].guid.startsWith("yt:video")) metaTitle = `Youtube - ${currentFeed[0].meta.title}`;
      else if (currentFeed[0].meta.link && currentFeed[0].meta.link.includes("reddit")) metaTitle = `Reddit - ${currentFeed[0].meta.title}`;

      if (currentGuilds.has(channel.guild.id)) {
        var guildRss = currentGuilds.get(channel.guild.id);
        if (!guildRss.sources) guildRss.sources = {};

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
        }
        guildRss.sources[rssName] = {
      		enabled: 1,
          title: metaTitle,
      		link: rssLink,
      		channel: channel.id
      	}
        currentGuilds.set(channel.guild.id, guildRss);
      }

      fileOps.updateFile(channel.guild.id, guildRss, `../sources/${channel.guild.id}.json`)
      callback()

    }

    return startDataProcessing()
  })

}
