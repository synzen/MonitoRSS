const express = require('express')
const guildFeedSubscriberAPI = express.Router({ mergeParams: true })
const controllers = require('../../../../../controllers/index.js')
const Joi = require('@hapi/joi')
const validator = require('express-joi-validation').createValidator({
  passError: true
});
const subscriberSchema = require('../../../../../util/validation/subscriberSchema.js')
const subscriberIDSchema = Joi.object({
  subscriberID: Joi.string()
})

// Create a subscriber
guildFeedSubscriberAPI.post(
  '/',
  validator.body(subscriberSchema),
  controllers.api.guilds.feeds.subscribers.createSubscriber
)

guildFeedSubscriberAPI.use('/:subscriberID', [
  validator.params(subscriberIDSchema)
])


module.exports = guildFeedSubscriberAPI
