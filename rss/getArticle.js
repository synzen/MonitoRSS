const FeedParser = require('feedparser');
const requestStream = require('./request.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const config = require('../config.json')
const currentGuilds = require('../util/storage.js').currentGuilds
const passesFilters = require('./translator/translate.js')

module.exports = function(guildId, rssName, passFiltersOnly, callback) {
  const rssList = currentGuilds.get(guildId).sources
  const feedparser = new FeedParser()
  const currentFeed = []
  const cookies = (rssList[rssName].advanced && rssList[rssName].advanced.cookies) ? rssList[rssName].advanced.cookies : undefined

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

    const con = sqlConnect(getArticle)

    function getArticle() {
      sqlCmds.selectTable(con, rssName, function(err, results) {
        if (err || results.size() === 0) {
          if (err) callback({type: 'database', content: err, feed: rssList[rssName]});
          if (results.size() === 0) callback(true, {type: 'deleted', content: `Nonexistent in database`, feed: rssList[rssName]});
          return sqlCmds.end(con, function(err) {
            if (err) throw err;
          })
        }

        if (passFiltersOnly) {
          const filteredCurrentFeed = [];

          for (var i in currentFeed) if (passesFilters(guildId, rssList, rssName, currentFeed[i], false)) filteredCurrentFeed.push(currentFeed[i]);

          const randFeedIndex = Math.floor(Math.random() * (filteredCurrentFeed.length - 1)); // Grab a random feed from array
          callback(false, filteredCurrentFeed[randFeedIndex]);
        }
        else {
          const randFeedIndex = Math.floor(Math.random() * (currentFeed.length - 1)); // Grab a random feed from array
          callback(false, currentFeed[randFeedIndex]);
        }

        return sqlCmds.end(con, function(err) {
          if (err) throw err;
        })

      })
    }

  })
}
