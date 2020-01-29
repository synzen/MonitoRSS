const express = require('express')
const guildChannelsAPI = express.Router({ mergeParams: true })
const controllers = require('../../../../controllers/index.js')

guildChannelsAPI.get('/', controllers.api.guilds.channels.getChannels)

module.exports = guildChannelsAPI
