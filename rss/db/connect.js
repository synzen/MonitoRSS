const config = require('../../config.json')
const mongoose = require('mongoose')

module.exports = callback => {
  mongoose.connect(config.database.uri, { keepAlive: 120 })
  mongoose.connection.on('error', callback)
  mongoose.connection.once('open', callback)
}
