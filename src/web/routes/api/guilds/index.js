const express = require('express')
const guildsAPI = express.Router({ mergeParams: true })
const validate = require('../../../middleware/validator.js')
const checkUserGuildPermission = require('../../../middleware/checkUserGuildPermission.js')
const controllers = require('../../../controllers/index.js')
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
guildsAPI.get('/:guildID', controllers.api.guilds.getGuild)

// Empty strings will signify deletions
guildsAPI.patch('/:guildID', validate([
  body('alert.*')
    .isString().withMessage('Must be a string')
    .notEmpty().withMessage('Cannot be empty'),
  body(['dateFormat', 'dateLanguage', 'timezone', 'prefix', 'locale'])
    .optional()
    .isString().withMessage('Must be a string')
    .bail(),
  body('timezone')
    .optional()
    .custom(isTimezone).withMessage('Unknown timezone'),
  body('locale')
    .optional()
    .custom(localeExists).withMessage('Unsupported locale'),
  body('dateLanguage')
    .optional()
    .custom(dateLanguageExists).withMessage('Unsupported language')
]), controllers.api.guilds.editGuild)

guildsAPI.use('/:guildID/feeds', require('./feeds/index.js'))

module.exports = guildsAPI
