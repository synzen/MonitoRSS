const feedServices = require('../../../../services/feed.js')
const createError = require('../../../../util/createError.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getFeedPlaceholders (req, res) {
  /** @type {import('../../../../../structs/db/Feed.js')} */
  const feed = req.feed
  const profile = req.guildData.profile || undefined
  try {
    const data = await feedServices.getFeedPlaceholders(feed.url, profile)
    res.json(data)
  } catch (err) {
    const resError = createError(500, err.message)
    return res.status(500).json(resError)
  }
}

module.exports = getFeedPlaceholders
