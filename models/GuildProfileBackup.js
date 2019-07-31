const mongoose = require('mongoose')
const dbSettings = require('../config.js').database
const guildBackupsExpire = dbSettings.guildBackupsExpire > 0 || dbSettings.guildBackupsExpire === -1 ? dbSettings.guildBackupsExpire : 7

function expireDate () {
  return () => {
    const date = new Date()
    date.setDate(date.getDate() + guildBackupsExpire) // Add days
    return date
  }
}

const schema = mongoose.Schema({
  id: {
    type: String,
    unique: true
  },
  name: String,
  sendAlertsTo: {
    type: [String],
    default: undefined
  },
  sources: Object,
  dateFormat: String,
  dateLanguage: String,
  timezone: String,
  version: String,
  date: {
    type: Date,
    default: Date.now
  },
  ...guildBackupsExpire > 0 ? { expiresAt: {
    type: Date,
    default: expireDate(),
    index: { expires: 0 }
  } } : {}
})

exports.schema = schema
exports.model = () => mongoose.model('guild_backups', schema)
