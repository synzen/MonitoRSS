const fs = require('fs')
const config = require('../../config.json')
const mongoose = require('mongoose')
const log = require('../../util/logger.js')
const BUFFER_CONFIGS = ['sslCA', 'sslCRL', 'sslCert', 'sslKey']
const CON_SETTINGS = typeof config.database.connection === 'object' ? config.database.connection : {}

module.exports = async () => {
  const uri = process.env.DRSS_DATABASE_URI || config.database.uri
  if (!uri.startsWith('mongo')) return // Means filebase sources will be used
  if (mongoose.connection.readyState === 1) return

  const buffers = {}
  if (Object.keys(CON_SETTINGS).length > 0) {
    for (var x = 0; x < BUFFER_CONFIGS.length; ++x) {
      const name = BUFFER_CONFIGS[x]
      if (CON_SETTINGS[name]) buffers[name] = fs.readFileSync(CON_SETTINGS[name])
    }
  }

  function connect () {
    // Do not use .then here since the promise never gets resolved for some reason
    mongoose.connect(uri, { keepAlive: 120, useNewUrlParser: true, ...CON_SETTINGS, ...buffers }) // Environment variable in Docker container if available
      .catch(err => {
        log.general.error('Failed to connect to database, retrying in 30 seconds...', err)
        setTimeout(connect, 30000)
      })
  }

  return new Promise((resolve, reject) => {
    connect()
    mongoose.connection.once('open', resolve)
  })
}
