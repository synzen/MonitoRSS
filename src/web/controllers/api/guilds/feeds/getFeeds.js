const feedServices = require('../../../../services/feed.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getFeeds (req, res, next) {
  const guildID = req.params.guildID
  try {
    const feeds = await feedServices.getFeedsOfGuild(guildID)
    res.json(feeds)
  } catch (err) {
    next(err)
  }
}

module.exports = getFeeds
