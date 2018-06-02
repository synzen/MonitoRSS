const fs = require('fs')
const dbSettings = require('../../config.json').database
const mongoose = require('mongoose')
const log = require('../../util/logger.js')
const BUFFER_CONFIGS = ['sslCA', 'sslCRL', 'sslCert', 'sslKey']
const CON_SETTINGS = typeof dbSettings.connection === 'object' ? dbSettings.connection : {}

module.exports = callback => {
  const buffers = {}
  if (Object.keys(CON_SETTINGS).length > 0) {
    for (var x = 0; x < BUFFER_CONFIGS.length; ++x) {
      const name = BUFFER_CONFIGS[x]
      if (CON_SETTINGS[name]) buffers[name] = fs.readFileSync(CON_SETTINGS[name])
    }
  }

  (function connect () {
    // Do not callback on .then here since the promise never gets resolved for some reason
    mongoose.connect(dbSettings.uri, { keepAlive: 120, ...CON_SETTINGS, ...buffers })
    .catch(err => {
      log.general.error('Failed to connect to database, retrying in 30 seconds...', err)
      setTimeout(connect, 30000)
    })
  })()

  mongoose.connection.once('open', callback)
}
