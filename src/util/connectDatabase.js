const fs = require('fs')
const mongoose = require('mongoose')
const createLogger = require('./logger/create.js')
const BUFFER_CONFIGS = ['sslCA', 'sslCRL', 'sslCert', 'sslKey']
const getConfig = require('../config.js').get

module.exports = async (shardID, skipRedis) => {
  const config = getConfig()
  const connectionSettings = config.database.connection || {}
  const log = createLogger(shardID)
  const uri = config.database.uri
  if (!uri.startsWith('mongo')) { // Databaseless configuration
    return
  }

  return new Promise((resolve, reject) => {
    const buffers = {}
    if (Object.keys(connectionSettings).length > 0) {
      for (var x = 0; x < BUFFER_CONFIGS.length; ++x) {
        const name = BUFFER_CONFIGS[x]
        if (connectionSettings[name]) buffers[name] = fs.readFileSync(connectionSettings[name])
      }
    }

    function connect () {
      // Do not use .then here since the promise never gets resolved for some reason
      const options = {
        keepAlive: 120,
        useCreateIndex: true,
        useFindAndModify: false,
        useUnifiedTopology: true,
        useNewUrlParser: true,
        ...connectionSettings,
        ...buffers
      }
      mongoose.connect(uri, options) // Environment variable in Docker container if available
        .catch(err => {
          log.fatal(err, 'Failed to connect to database, retrying in 30 seconds...')
          setTimeout(connect, 30000)
        })

      mongoose.connection.once('open', resolve)
    }

    if (mongoose.connection.readyState === 1) return resolve()
    else connect()
  })
}
