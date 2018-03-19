const config = require('../config.json')
const linkErrs = config.log.linkErrs
const storage = require('./storage.js')
const log = require('./logger.js')

module.exports = err => { // "linkOnly" refers to whether it will skip ALL feeds with a particular link
  const failedLinks = storage.failedLinks
  const failLimit = (config.feeds.failLimit && !isNaN(parseInt(config.feeds.failLimit, 10))) ? parseInt(config.feeds.failLimit, 10) : 0

  if (linkErrs === false || linkErrs !== true) return
  const failCount = failedLinks[err.link] ? failedLinks[err.link] + 1 : null

  log.cycle.warning(`Skipping all feeds with link ${err.link}. ${failLimit && failedLinks[err.link] ? ' (Consecutive fails: ' + failCount + ')' : ''}`, err)
}
