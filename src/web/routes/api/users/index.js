const express = require('express')
const usersAPI = express.Router()

usersAPI.get('/@me', require('../../../controllers/api/users/getMe.js'))
usersAPI.get('/@bot', require('../../../controllers/api/users/getBot.js'))
usersAPI.get('/@me/guilds', require('../../../controllers/api/users/getMeGuilds.js'))

module.exports = usersAPI
