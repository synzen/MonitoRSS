const express = require('express')
const guildRolesAPI = express.Router({ mergeParams: true })
const controllers = require('../../../../controllers/index.js')

guildRolesAPI.get('/', controllers.api.guilds.roles.getRoles)

module.exports = guildRolesAPI
