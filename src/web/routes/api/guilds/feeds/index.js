const express = require('express')
const guildFeedsAPI = express.Router({ mergeParams: true })
const validate = require('../../../../middleware/validator.js')
const guildHasFeed = require('../../../../middleware/guildHasFeed.js')
const guildHasChannel = require('../../../../middleware/guildHasChannel.js')
const {
  isMongoID
} = require('../../../../util/validators/index.js')
const {
  param,
  body
} = require('express-validator')

guildFeedsAPI.use('/:feedID', validate([
  param('feedID')
    .custom(isMongoID).withMessage('Invalid resource ID')
]))

guildFeedsAPI.post('/', [
  validate([
    body(['url', 'channel'])
      .exists({ checkFalsy: true }).withMessage('Must exist')
      .isString().withMessage('Must be a string'),
  ]),
  guildHasChannel
], require('../../../../controllers/api/guilds/feeds/createFeed.js'))

guildFeedsAPI.use('/:feedID', guildHasFeed)

module.exports = guildsAPI
