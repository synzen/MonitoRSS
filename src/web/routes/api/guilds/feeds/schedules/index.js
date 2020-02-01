const express = require('express')
const guildFeedScheduleAPI = express.Router({ mergeParams: true })
const controllers = require('../../../../../controllers/index.js')

guildFeedScheduleAPI.get(
  '/',
  controllers.api.guilds.feeds.schedules.getSchedule
)

module.exports = guildFeedScheduleAPI
