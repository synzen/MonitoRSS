const config = require('../config.json')
const showLinkErrs = config.logging.showLinkErrs
const storage = require('./storage.js')
const log = require('./logger.js')

module.exports = err => { // "linkOnly" refers to whether it will skip ALL feeds with a particular link
  const failedLinks = storage.failedLinks
  const failLimit = (config.feedSettings.failLimit && !isNaN(parseInt(config.feedSettings.failLimit, 10))) ? parseInt(config.feedSettings.failLimit, 10) : 0

  if (showLinkErrs === false || showLinkErrs !== true) return
  const failCount = failedLinks[err.link] ? failedLinks[err.link] + 1 : null

  log.rss.warning(`Skipping all feeds with link ${err.link}. ${failLimit && failedLinks[err.link] ? ' (Consecutive fails: ' + failCount + ')' : ''}`, err)
}
