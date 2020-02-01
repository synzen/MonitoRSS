const feedServices = require('../../../../../services/feed.js')

/**
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @param {import('express').NextFunction} next 
 */
async function getFailRecord (req, res, next) {
  const feed = req.feed
  try {
    const record = await feedServices.getFailRecord(feed.url)
    res.json(record)
  } catch (err) {
    next(err)
  }
}

module.exports = getFailRecord
