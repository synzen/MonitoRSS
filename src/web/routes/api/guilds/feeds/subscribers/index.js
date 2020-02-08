const express = require('express')
const guildFeedSubscriberAPI = express.Router({ mergeParams: true })
const controllers = require('../../../../../controllers/index.js')
const feedHasSubscriber = require('../../../../../middleware/feedHasSubscriber.js')
const Joi = require('@hapi/joi')
const validator = require('express-joi-validation').createValidator({
  passError: true
});
const filterSchema = require('../../../../../util/validation/filterSchema.js')
const subscriberSchema = require('../../../../../util/validation/subscriberSchema.js')
const subscriberGetSchema = Joi.object({
  guildID: Joi.string(),
  feedID: Joi.string()
})
const subscriberWithIDSchema = Joi.object({
  guildID: Joi.string(),
  feedID: Joi.string(),
  subscriberID: Joi.string()
})

// Get subscribers of a feed
guildFeedSubscriberAPI.get(
  '/',
  validator.params(subscriberGetSchema),
  controllers.api.guilds.feeds.subscribers.getSubscribers
)

// Create a subscriber
guildFeedSubscriberAPI.post(
  '/',
  validator.body(subscriberSchema),
  controllers.api.guilds.feeds.subscribers.createSubscriber
)

// Validate the subscriber exists for the feed in params
guildFeedSubscriberAPI.use(
  '/:subscriberID',
  validator.params(subscriberWithIDSchema),
  feedHasSubscriber
)

// Delete a subscriber
guildFeedSubscriberAPI.delete(
  '/:subscriberID',
  controllers.api.guilds.feeds.subscribers.deleteSubscriber
)

// Edit a subscriber
guildFeedSubscriberAPI.patch(
  '/:subscriberID',
  validator.body(filterSchema),
  controllers.api.guilds.feeds.subscribers.editSubscriber
)


module.exports = guildFeedSubscriberAPI
