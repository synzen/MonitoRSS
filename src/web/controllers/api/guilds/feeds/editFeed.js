const feedServices = require('../../../../services/feed.js')
const keys = [
  'title',
  'checkTitles',
  'checkDates',
  'imgPreviews',
  'imgLinksExistence',
  'formatTables',
  'toggleRoleMentions',
  'text',
  'embeds'
]

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function editFeed (req, res, next) {
  /** @type {import('../../../../../structs/db/Feed.js')} */  
  const body = req.body
  const feedID = req.params.feedID
  const data = {}
  for (const key of keys) {
    const bodyValue = body[key]
    if (bodyValue === '') {
      data[key] = undefined
    } else if (body[key] !== undefined) {
      data[key] = body[key]
    }
  }
  if (body.channelID) {
    data.channel = body.channelID
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
