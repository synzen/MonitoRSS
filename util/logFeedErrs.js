const config = require('../config.json')
const logFeedErrs = config.logging.showFeedErrs
const failedFeeds = require('./storage.js').failedFeeds

module.exports = function(err, linkOnly) { // "linkOnly" refers to whether it will skip ALL feeds with a particular link
  const failLimit = (config.feedSettings.failLimit && !isNaN(parseInt(config.feedSettings.failLimit, 10))) ? parseInt(config.feedSettings.failLimit, 10) : 0

  if (!logFeedErrs) return;
  const failCount = failedFeeds[err.link] ? failedFeeds[err.link] + 1 : null

  if (linkOnly) console.log(`RSS Error: Skipping all feeds with link ${err.link}. (${err.content})${failLimit && failedFeeds[err.link] ? ' (Consecutive fails: ' + failCount + ')' : ''}`);
  else console.log(`RSS Error: Skipping ${err.link} for channel ${err.feed.channel}. (${err.content})`);
}
