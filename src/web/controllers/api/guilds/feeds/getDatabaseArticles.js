const feedServices = require('../../../../services/feed.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getDatabaseArticles (req, res, next) {
  /** @type {import('../../../../../structs/db/Feed.js')} */
  const feed = req.feed
  const shardID = req.guild.shard
  try {
    const data = await feedServices.getDatabaseArticles(feed, shardID)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = getDatabaseArticles
