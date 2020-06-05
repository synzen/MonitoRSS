const fs = require('fs')
const createLogger = require('./logger/create.js')

function dumpHeap (prefix) {
  const log = createLogger()
  try {
    const heapdump = require('heapdump')
    if (!fs.existsSync('./settings/heapdump')) {
      fs.mkdirSync('./settings/heapdump')
    }
    const filename = `./settings/heapdump/${prefix}-${Date.now()}.heapsnapshot`
    heapdump.writeSnapshot(filename)
    log.info(`Dumped heap at ${filename}`)
  } catch (err) {
    log.error(err, 'Failed to dump heap')
  }
}

module.exports = dumpHeap
