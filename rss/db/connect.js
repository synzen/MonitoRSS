const config = require('../../config.json')
const mongoose = require('mongoose')

module.exports = function (callback, type) {
  mongoose.connect(config.database.uri, {
    keepAlive: 120
  })
  const db = mongoose.connection

  db.on('error', callback)
  db.once('open', callback)
}
