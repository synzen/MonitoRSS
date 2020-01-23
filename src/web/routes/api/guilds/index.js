const express = require('express')
const guildsAPI = express.Router({ mergeParams: true })
const validate = require('../../../middleware/validator.js')
const checkUserGuildPermission = require('../../../middleware/checkUserGuildPermission.js')
const {
  isTimezone,
  localeExists,
  dateLanguageExists
} = require('../../../util/validators/index.js')
const {
  param,
  body
} = require('express-validator')


guildsAPI.use('/:guildID', validate([
  param('guildID').isNumeric({
    no_symbols: true
  })
]))
guildsAPI.use('/:guildID', checkUserGuildPermission)
guildsAPI.get('/:guildID', require('../../../controllers/api/guilds/getGuild.js'))
guildsAPI.patch('/:guildID', validate([
  body('alert.*')
    .isString().withMessage('Must be a string')
    .notEmpty().withMessage('Cannot be empty'),
  body(['dateFormat', 'dateLanguage', 'timezone', 'prefix', 'locale'])
    .if(val => !!val)
    .isString().withMessage('Must be a string'),
  body('timezone')
    .if(val => !!val)
    .custom(isTimezone).withMessage('Unknown timezone'),
  body('locale')
    .if(val => !!val)
    .custom(localeExists).withMessage('Unsupported locale'),
  body('dateLanguage')
    .if(val => !!val)
    .custom(dateLanguageExists).withMessage('Unsupported language')
]))
guildsAPI.use('/:guildID/feeds')

module.exports = guildsAPI
