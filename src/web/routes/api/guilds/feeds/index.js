const express = require('express')
const guildFeedsAPI = express.Router({ mergeParams: true })
const validate = require('../../../../middleware/validator.js')
const guildHasFeed = require('../../../../middleware/guildHasFeed.js')
const guildHasChannel = require('../../../../middleware/guildHasChannel.js')
const guildHasChannelOptional = require('../../../../middleware/guildHasChannelOptional.js')
const controllers = require('../../../../controllers/index.js')
const {
  isMongoID
} = require('../../../../util/validators/index.js')
const {
  param,
  body
} = require('express-validator')

guildFeedsAPI.post('/', [
  validate([
    body(['url', 'channel'])
      .isString().withMessage('Must be a string')
      .notEmpty().withMessage('Cannot be empty'),
  ]),
  guildHasChannel
], controllers.api.guilds.feeds.createFeed)

// Make sure feedID exists before proceeding
guildFeedsAPI.use('/:feedID', validate([
  param('feedID')
    .custom(isMongoID).withMessage('Invalid resource ID')
]))

// Make sure the guild has this feed, and inject the feed into req.feed
guildFeedsAPI.use('/:feedID', guildHasFeed)

// Edit the feed
guildFeedsAPI.patch('/:feedID', [
  validate([
    body(['channel', 'title'])
      .optional()
      .isString().withMessage('Must be a string')
      .notEmpty().withMessage('Cannot be empty'),
    body([
      'checkTitles',
      'checkDates',
      'imgPreviews',
      'imgLinksExistence',
      'formatTables',
      'toggleRoleMentions'
    ]).optional()
      .isBoolean().withMessage('Must be a boolean'),
  body('text')
    .optional()
    .isString().withMessage('Must be a string')
    .notEmpty().withMessage('Cannot be empty'),
  body('embeds')
    .optional()
    .isArray({
      min: 1
    }).withMessage('Must be a populated array'),
  body('filters.*')
    .isArray({
      min: 1
    }).withMessage('Must be a populated array'),
  body('filters.*.*')
    .isString().withMessage('Must be a string')
    .notEmpty().withMessage('Cannot be empty')
  ]),
  guildHasChannelOptional
], controllers.api.guilds.feeds.editFeed)

// Delete the feed
guildFeedsAPI.delete('/:feedID', controllers.api.guilds.feeds.deleteFeed)

// Get feed placeholders
guildFeedsAPI.get('/:feedID/placeholders', controllers.api.guilds.feeds.getFeedPlaceholders)

// Get database articles for debugging
guildFeedsAPI.get('/:feedID/database', controllers.api.guilds.feeds.getDatabaseArticles)

module.exports = guildFeedsAPI
