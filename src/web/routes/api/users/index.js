const express = require('express')
const usersAPI = express.Router()
const controllers = require('../../../controllers/index.js')

usersAPI.get('/@me', controllers.api.users.getMe)
usersAPI.get('/@bot', controllers.api.users.getBot)
usersAPI.get('/@me/guilds', controllers.api.users.getMeGuilds)

module.exports = usersAPI
