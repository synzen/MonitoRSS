const subscriberServices = require('../services/subscriber')
const createError = require('../util/createError.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function feedHasSubscriber (req, res, next) {
  try {
    const feedID = req.params.feedID
    const subscriberID = req.params.subscriberID
    const subscriber = await subscriberServices.getSubscriberOfFeed(feedID, subscriberID)
    if (!subscriber) {
      const error = createError(404, 'Unknown subscriber')
      res.status(404).json(error)
    } else {
      req.subscriber = subscriber
      next()
    }
  } catch (err) {
    next(err)
  }
}

module.exports = feedHasSubscriber
