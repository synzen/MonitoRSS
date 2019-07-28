const express = require('express')
const feeds = express.Router()
const config = require('../../../config.js')
const Article = require('../../../structs/Article.js')
const axios = require('axios')
const log = require('../../../util/logger.js')
const FeedFetcher = require('../../../util/FeedFetcher.js')
const RequestError = require('../../../structs/errors/RequestError.js')
const FeedParserError = require('../../../structs/errors/FeedParserError.js')
const statusCodes = require('../../constants/codes.js')
// const feedsJson = require('../../tests/files/feeds.json')
const rateLimit = require('express-rate-limit')
const DATE_SETTINGS = {
  timezone: config.feeds.timezone,
  format: config.feeds.dateFormat,
  language: config.feeds.dateLanguage
}
if (process.env.NODE_ENV !== 'test') {
  feeds.use(rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20, // 20 requests per 1 minute
    message: {
      code: 429,
      message: 'Too many requests'
    }
  }))
}

async function validUrl (req, res, next) {
  const feedUrl = req.params.url
  if (!feedUrl) return res.status(400).json({ code: 400, message: 'No url in param specified' })
  if (feedUrl.includes('feed43.com')) return res.status(403).json({ code: 403, message: 'feed43 feeds are forbidden' })
  next()
}

async function getUrl (req, res, next) {
  try {
    const feedUrl = req.params.url
    const allPlaceholders = []
    let xmlStr = ''

    try {
      const { articleList } = await FeedFetcher.fetchFeed(feedUrl)
      for (const article of articleList) {
        const articlePlaceholders = {}
        const parsed = new Article(article, {}, DATE_SETTINGS)
        for (const placeholder of parsed.placeholders) {
          articlePlaceholders[placeholder] = parsed[placeholder]
        }
        articlePlaceholders._id = parsed.id
        allPlaceholders.push(articlePlaceholders)
      }
    } catch (err) {
      if (err instanceof RequestError) return res.status(500).json({ code: statusCodes['50042_FEED_CONNECTION_FAILED'].code, message: err.message })
      if (err instanceof FeedParserError && err.message.includes('valid feed')) return res.status(400).json({ code: statusCodes['40002_FEED_INVALID'].code, message: err.message })
      return res.status(500).json({ code: 500, message: err.message })
    }

    try {
      xmlStr = (await axios.get(feedUrl)).data
    } catch (err) {
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      log.web.warning('Failed to get feed XML - ' + errMessage)
      return res.status(500).json({ code: 500, message: errMessage })
    }

    res.json({ placeholders: allPlaceholders, xml: xmlStr })
  } catch (err) {
    next(err)
  }
}

feeds.get('/:url', getUrl)

module.exports = {
  middleware: {
    validUrl
  },
  routes: {
    getUrl
  },
  router: feeds
}
