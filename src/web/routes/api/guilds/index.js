const express = require('express')
const guildsAPI = express.Router({ mergeParams: true })
const checkUserGuildPermission = require('../../../middleware/checkUserGuildPermission.js')
const controllers = require('../../../controllers/index.js')
const Joi = require('@hapi/joi')
const validator = require('express-joi-validation').createValidator({
  passError: true
})
const profileSchema = require('../../../util/validation/profileSchema.js')

const guildIDSchema = Joi.object({
  guildID: Joi.string()
})

guildsAPI.use('/:guildID', validator.params(guildIDSchema))
guildsAPI.use('/:guildID', checkUserGuildPermission)
guildsAPI.get('/:guildID', controllers.api.guilds.getGuild)
guildsAPI.patch('/:guildID', validator.body(profileSchema), controllers.api.guilds.editGuild)
guildsAPI.use('/:guildID/feeds', require('./feeds/index.js'))
guildsAPI.use('/:guildID/channels', require('./channels/index.js'))
guildsAPI.use('/:guildID/roles', require('./roles/index.js'))
guildsAPI.use('/:guildID/failrecords', require('./failrecords/index.js'))

module.exports = guildsAPI
