const express = require('express')
const guildFeedsAPI = express.Router({ mergeParams: true })
const guildHasFeed = require('../../../../middleware/guildHasFeed.js')
const guildHasChannel = require('../../../../middleware/guildHasChannel.js')
const guildHasChannelOptional = require('../../../../middleware/guildHasChannelOptional.js')
const controllers = require('../../../../controllers/index.js')
const Joi = require('@hapi/joi')
const validator = require('express-joi-validation').createValidator({
  passError: true
});
const feedSchema = require('../../../../util/validation/feedSchema.js')
const feedIDSchema = Joi.object({
  feedID: Joi.string()
})
guildFeedsAPI.post('/', [
  validator.body(feedSchema),
  guildHasChannel
], controllers.api.guilds.feeds.createFeed)

// Make sure feedID exists before proceeding
guildFeedsAPI.use('/:feedID', validator.params(feedIDSchema))

// Make sure the guild has this feed, and inject the feed into req.feed
guildFeedsAPI.use('/:feedID', guildHasFeed)

// Edit the feed
guildFeedsAPI.patch('/:feedID', [
  validator.body(feedSchema),
  guildHasChannelOptional
], controllers.api.guilds.feeds.editFeed)

// Delete the feed
guildFeedsAPI.delete('/:feedID', controllers.api.guilds.feeds.deleteFeed)

// Get feed placeholders
guildFeedsAPI.get('/:feedID/placeholders', controllers.api.guilds.feeds.getFeedPlaceholders)

// Get database articles for debugging
guildFeedsAPI.get('/:feedID/database', controllers.api.guilds.feeds.getDatabaseArticles)

// Handle subscribers
guildFeedsAPI.get(`/:feedID/subscribers`, require('./subscribers/index.js'))

// Handle schedules
guildFeedsAPI.get('/:feedID/schedules', require('./schedules/index.js'))

module.exports = guildFeedsAPI
