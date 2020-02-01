const express = require('express')
const guildFeedFailRecordsAPI = express.Router({ mergeParams: true })
const controllers = require('../../../../../controllers/index.js')

guildFeedFailRecordsAPI.get(
  '/',
  controllers.api.guilds.feeds.failrecords.getFailRecord
)

module.exports = guildFeedFailRecordsAPI
