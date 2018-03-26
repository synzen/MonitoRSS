const fs = require('fs')
const dbSettings = require('../../config.json').database
const mongoose = require('mongoose')
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
  mongoose.connect(dbSettings.uri, { keepAlive: 120, ...CON_SETTINGS, ...buffers })
  mongoose.connection.on('error', callback)
  mongoose.connection.once('open', callback)
}
