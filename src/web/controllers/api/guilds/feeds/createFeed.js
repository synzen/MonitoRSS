const feedServices = require('../../../../services/feed.js')
const createError = require('../../../../util/createError.js')
const FeedParserError = require('../../../../../structs/errors/FeedParserError.js')
const RequestError = require('../../../../../structs/errors/RequestError.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createFeed (req, res, next) {
  const data = {
    guild: req.params.guildID,
    channel: req.body.channel,
    url: req.body.url
  }
  try {
    const created = await feedServices.createFeed(data)
    res.status(201).json(created)
  } catch (err) {
    const message = err.message
    if (message.includes('this channel')) {
      const createdError = createError(400, err.message)
      res.status(400).json(createdError)
    } else if (err instanceof FeedParserError || err instanceof RequestError) {
      const createdError = createError(500, err.message)
      res.status(500).json(createdError)
    } else {
      next(err)
    }
  }
}

module.exports = createFeed
