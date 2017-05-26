const config = require('../config.json')
const showLinkErrs = config.logging.showLinkErrs
const failedLinks = require('./storage.js').failedLinks

module.exports = function (err) { // "linkOnly" refers to whether it will skip ALL feeds with a particular link
  const failLimit = (config.feedSettings.failLimit && !isNaN(parseInt(config.feedSettings.failLimit, 10))) ? parseInt(config.feedSettings.failLimit, 10) : 0

  if (showLinkErrs === false || showLinkErrs !== true) return
  const failCount = failedLinks[err.link] ? failedLinks[err.link] + 1 : null

  console.log(`RSS Error: Skipping all feeds with link ${err.link}. (${err.content})${failLimit && failedLinks[err.link] ? ' (Consecutive fails: ' + failCount + ')' : ''}`)
}
