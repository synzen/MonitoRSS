const feedServices = require('../services/feed.js')
const createError = require('../util/createError.js')

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function guildHasFeed (req, res, next) {
  try {
    const guildID = req.params.guildID
    const feedID = req.params.feedID
    const feed = await feedServices.getFeedOfGuild(guildID, feedID)
    if (!feed) {
      const error = createError(404, 'Unknown feed')
      res.status(404).json(error)
    } else {
      req.feed = feed
      next()
    }
  } catch (err) {
    next(err)
  }
}

module.exports = guildHasFeed
