const subscriberServices = require('../../../../../services/subscriber.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function deleteSubscriber (req, res, next) {
  const feedID = req.params.feedID
  const subscriberID = req.params.subscriberID
  try {
    await subscriberServices.deleteSubscriberOfFeed(feedID, subscriberID)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

module.exports = deleteSubscriber
