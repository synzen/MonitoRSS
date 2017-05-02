const FeedParser = require('feedparser');
const requestStream = require('./request.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const config = require('../config.json')
const currentGuilds = require('../util/storage.js').currentGuilds

module.exports = function(con, guildId, rssName, callback) {
  const rssList = currentGuilds.get(guildId).sources
  const feedparser = new FeedParser()
  const currentFeed = []

  var cookies = (rssList[rssName].advanced && rssList[rssName].advanced.cookies) ? rssList[rssName].advanced.cookies : undefined

  requestStream(rssList[rssName].link, cookies, feedparser, function(err) {
    if (err) return callback({type: 'request', content: err, feed: rssList[rssName]});
  })

  feedparser.on('error', function(err) {
    feedparser.removeAllListeners('end')
    return callback({type: 'feedparser', content: err, feed: rssList[rssName]})
  });

  feedparser.on('readable', function() {
    let item

    while (item = this.read()) {
      currentFeed.push(item);
    }

  });

  feedparser.on('end', function() {
    if (currentFeed.length === 0) return callback({type: 'feedparser', content: 'No existing feeds', feed: rssList[rssName]})

    sqlCmds.selectTable(con, rssName, function(err, results) {
      if (err || results.size() === 0) {
        if (err) return callback({type: 'database', content: err, feed: rssList[rssName]});
        if (results.size() === 0) return callback(true, {type: 'deleted', content: `Nonexistent in database`, feed: rssList[rssName]});
      }
      const randFeedIndex = Math.floor(Math.random() * (currentFeed.length - 1)); // Grab a random feed from array
      return callback(false, currentFeed[randFeedIndex]);
    })

  })
}
