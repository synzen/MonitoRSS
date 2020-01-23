const feedServices = require('../../../../services/feed.js')

/**
 * 
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function editFeed (req, res, next) {
  /** @type {import('../../../../../structs/db/Feed.js')} */
  const feedID = req.params.feedID
  const data = {}
  if (req.body.title) {
    data.title = req.body.title
  }
  if (req.body.channelID) {
    data.channel = req.body.channelID
  }
  if (Object.keys(data).length === 0) {
    return res.status(304).end()
  }
  try {
    const edited = await feedServices.editFeed(feedID, data)
    res.json(edited)
  } catch (err) {
    next(err)
  }
}

module.exports = editFeed
