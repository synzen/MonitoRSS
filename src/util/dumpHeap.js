const fs = require('fs')
const heapdump = require('heapdump')

function dumpHeap (prefix) {
  if (!fs.existsSync('./settings/heapdump')) {
    fs.mkdirSync('./settings/heapdump')
  }
  heapdump.writeSnapshot(`./settings/heapdump/${prefix}-${Date.now()}.heapsnapshot`)
}

module.exports = dumpHeap
