const fs = require('fs')
const path = require('path')
const log = require('./logger.js')
const debugPath = path.join(__dirname, '..', '..', 'settings', 'debug.json')

let debugRssNames = []

if (fs.existsSync(debugPath)) {
  log.debug.info('Preloaded debug data from settings/debug.json')
  debugRssNames = JSON.parse(fs.readFileSync(debugPath))
}

exports.list = debugRssNames
