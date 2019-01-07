const fs = require('fs')
const config = require('../../config.js')
const mongoose = require('mongoose')
mongoose.set('useCreateIndex', true)
const log = require('../../util/logger.js')
const BUFFER_CONFIGS = ['sslCA', 'sslCRL', 'sslCert', 'sslKey']
const storage = require('../../util/storage.js')
const CON_SETTINGS = typeof config.database.connection === 'object' ? config.database.connection : {}

module.exports = async () => {
  const uri = config.database.uri
  if (!uri.startsWith('mongo')) return // Means filebase sources will be used

  return new Promise((resolve, reject) => {
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

      mongoose.connection.once('open', resolve)
    }

    if (process.env.DRSS_EXPERIMENTAL_FEATURES && !storage.redisClient) {
      storage.redisClient = require('redis').createClient(config.database.redis)
      storage.redisClient.once('ready', () => {
        log.general.success(`Redis connection ready`)
        storage.redisClient.flushdb((err, res) => {
          if (err) throw err
          return mongoose.connection.readyState === 1 ? resolve() : connect()
        })
      })

      storage.redisClient.on('error', err => {
        log.general.error('Redis Client error encountered, stopping')
        throw err
      })
    } else if (mongoose.connection.readyState === 1) return resolve()
    else connect()
  })
}
