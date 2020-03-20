const subscriberServices = require('../../../../../services/subscriber.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getSubscribers (req, res, next) {
  const feedID = req.params.feedID
  try {
    const subscribers = await subscriberServices.getSubscribersOfFeed(feedID)
    res.json(subscribers)
  } catch (err) {
    next(err)
  }
}

module.exports = getSubscribers
