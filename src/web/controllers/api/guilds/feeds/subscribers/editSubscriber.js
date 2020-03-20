const subscriberServices = require('../../../../../services/subscriber.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function editSubscriber (req, res, next) {
  const feedID = req.params.feedID
  const subscriberID = req.params.subscriberID
  if (!req.body.filters) {
    return res.status(304).end()
  }
  const data = {
    filters: req.body.filters
  }
  try {
    const edited = await subscriberServices.editSubscriber(feedID, subscriberID, data)
    res.json(edited)
  } catch (err) {
    next(err)
  }
}

module.exports = editSubscriber
