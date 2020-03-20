const feedServices = require('../../../../services/feed.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function editFeed (req, res, next) {
  /** @type {import('../../../../../structs/db/Feed.js')} */
  const feedID = req.params.feedID
  try {
    await feedServices.deleteFeed(feedID)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

module.exports = editFeed
