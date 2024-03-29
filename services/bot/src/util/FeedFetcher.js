const fetch = require('node-fetch')
const AbortController = require('abort-controller').AbortController
const RequestError = require('../structs/errors/RequestError.js')
const FeedParserError = require('../structs/errors/FeedParserError.js')
const DecodedFeedParser = require('../structs/DecodedFeedParser.js')
const ArticleIDResolver = require('../structs/ArticleIDResolver.js')
const Article = require('../structs/Article.js')
const configuration = require('../config.js')

class FeedFetcher {
  constructor () {
    throw new Error('Cannot be instantiated')
  }

  static get REQUEST_ERROR_CODE () {
    return 50042
  }

  static get FEEDPARSER_ERROR_CODE () {
    return 40002
  }

  /**
   * @typedef {Object} FormattedResponse
   * @property {number} status
   * @property {Object} headers
   */

  /**
   * @param {string} url
   * @param {string} userAgent
   */
  static resolveUserAgent (url, userAgent) {
    if (url.includes('.tumblr.com')) {
      // tumblr only allows GoogleBot to automatically view NSFW feeds
      const tempParts = userAgent.split(' ')
      tempParts.splice(1, 0, 'GoogleBot')
      return tempParts.join(' ')
    } else {
      return userAgent
    }
  }

  /**
   * Responses must be uniform
   * @param {import('node-fetch').Response} res
   * @returns {FormattedResponse}
   */
  static formatNodeFetchResponse (res) {
    const rawHeaders = res.headers.raw()
    const headers = {
      ...rawHeaders
    }
    // Normalize the headers
    for (const key in headers) {
      const val = headers[key]
      delete headers[key]
      headers[key.toLowerCase()] = val
    }
    // Sometimes it's an array for some reason
    if (Array.isArray(headers.etag)) {
      headers.etag = headers.etag[0]
    }
    if (Array.isArray(headers['last-modified'])) {
      headers['last-modified'] = headers['last-modified'][0]
    }
    if (Array.isArray(headers['content-type'])) {
      headers['content-type'] = headers['content-type'][0]
    }
    return {
      status: res.status,
      headers
    }
  }

  /**
   * @param {string} url
   * @param {Object<string, any>} requestOptions
   */
  static createFetchOptions (url, requestOptions = {}) {
    const config = configuration.get()
    const options = {
      follow: 5,
      ...requestOptions,
      headers: {
        'user-agent': this.resolveUserAgent(url, config.bot.userAgent)
      }
    }

    if (requestOptions.headers) {
      options.headers = {
        ...options.headers,
        ...requestOptions.headers
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, config.bot.feedRequestTimeoutMs)

    options.signal = controller.signal

    return {
      options,
      timeout
    }
  }

  /**
   * @typedef {object} FetchResults
   * @property {import('stream').Readable} stream
   * @property {import('node-fetch').Response} response
   */

  /**
   * Fetch a URL
   * @param {string} url - URL to fetch
   * @param {object} requestOptions - Options to directly pass to fetch
   * @param {boolean} retried - If true, recursive retries will not be made
   * @returns {FetchResults}
   */
  static async fetchURL (url, requestOptions = {}, retried) {
    if (!url) throw new Error('No url defined')
    const { options, timeout } = this.createFetchOptions(url, requestOptions)
    let endStatus
    let res

    try {
      res = await fetch(url, options)
    } catch (err) {
      throw new RequestError(null, err.message === 'The user aborted a request.' ? 'Connected timed out' : err.message)
    } finally {
      clearTimeout(timeout)
    }

    endStatus = res.status

    // Fetch returns a 304 if the two properties below were passed in by the calling function to check if there are new feeds
    if (res.status === 200 || (res.status === 304 && 'If-Modified-Since' in options.headers && 'If-None-Match' in options.headers)) {
      return {
        stream: res.body,
        response: this.formatNodeFetchResponse(res)
      }
    }
    if (!retried && (res.status === 403 || res.status === 400)) {
      delete options.headers
      const res2 = await this.fetchURL(url, {
        ...options,
        headers: {
          ...options.headers,
          'user-agent': ''
        }
      }, true)
      endStatus = res2.response.status
      if (endStatus === 200) {
        return res2
      }
    }

    const serverHeaders = res.headers.get('server')
    if (!serverHeaders || !serverHeaders.includes('cloudflare')) {
      throw new RequestError(this.REQUEST_ERROR_CODE, `Bad status code (${endStatus})`)
    }

    // Cloudflare errors
    throw new RequestError(endStatus, `Bad Cloudflare status code (${endStatus})`, true)
  }
  /**
   * @typedef {Object} CSResults
   * @property {import('stream').Readable} stream
   * @property {Object<string, any>} response
   */

  /**
 * @typedef {object} FeedData
 * @property {object[]} articleList - Array of articles
 * @property {string} idType - The ID type used for the article ._id property
 */

  /**
   * Parse a stream and return the article list, and the article ID type used
   * @param {object} stream
   * @param {string} url - The fetched URL of this stream
   * @param {charset} [encoding] - Response charset
   * @returns {FeedData} - The article list and the id type used
   */
  static async parseStream (stream, url, charset) {
    if (!url) {
      throw new Error('No url defined')
    }
    const feedparser = new DecodedFeedParser(null, url, charset)
    const idResolver = new ArticleIDResolver()
    const articleList = []

    return new Promise((resolve, reject) => {
      const config = configuration.get()
      setTimeout(() => {
        reject(new FeedParserError(null, 'Feed parsing took too long'))
      }, config.bot.feedParseTimeoutMs || 10000)

      stream.on('error', err => {
        // feedparser may not handle all errors such as incorrect headers. (feedparser v2.2.9)
        reject(new FeedParserError(this.REQUEST_ERROR_CODE, err.message))
      })

      feedparser.on('error', err => {
        feedparser.removeAllListeners('end')
        if (err.message === 'Not a feed') {
          reject(new FeedParserError(this.FEEDPARSER_ERROR_CODE, 'That is a not a valid feed. Note that you cannot add just any link. You may check if it is a valid feed by using online RSS feed validators'))
        } else {
          reject(new FeedParserError(null, err.message))
        }
      })

      feedparser.on('readable', function () {
        let item
        do {
          item = this.read()
          if (item) {
            idResolver.recordArticle(item)
            articleList.push(item)
          }
        } while (item)
      })

      feedparser.on('end', () => {
        if (articleList.length === 0) {
          return resolve({ articleList })
        }
        const idType = idResolver.getIDType()
        for (const article of articleList) {
          article._id = ArticleIDResolver.getIDTypeValue(article, idType)
        }
        resolve({ articleList, idType })
      })

      stream.pipe(feedparser)
    })
  }

  /**
   * Fetch and parse results, and result the article list and id type
   * @param {string} url - The URL to fetch
   * @param {object} options - The options to pass to fetch
   * @returns {FeedData} - The article list and the id type used
   */
  static async fetchFeed (url, options) {
    const { stream, response } = await this.fetchURL(url, options)
    const charset = this.getCharsetFromResponse(response)
    const { articleList, idType } = await this.parseStream(stream, url, charset)
    return { articleList, idType }
  }

  static async fetchFilteredFeed (url, filters) {
    const { articleList, idType } = await this.fetchFeed(url)
    const filtered = articleList.filter(article => {
      const parsed = new Article(article, { feed: {} })
      return parsed.testFilters(filters).passed
    })
    return {
      articleList: filtered,
      idType
    }
  }

  /**
   * Get a random article in the feed
   * @param {string} url - The URL to fetch
   * @param {object} filters
   * @returns {object|null} - Either null, or an article object
   */
  static async fetchRandomArticle (url, filters) {
    const { articleList } = filters
      ? await this.fetchFilteredFeed(url, filters)
      : await this.fetchFeed(url)
    if (articleList.length === 0) {
      return null
    }
    return articleList[Math.round(Math.random() * (articleList.length - 1))]
  }

  static async fetchLatestArticle (url) {
    const { articleList } = await this.fetchFeed(url)
    if (articleList.length === 0) {
      return null
    }
    const allHaveValidDates = articleList.every(article => {
      const date = new Date(article.pubDate)
      return !isNaN(date.getTime())
    })
    if (!allHaveValidDates) {
      return null
    }
    return articleList.sort((a, b) => {
      return new Date(b.pubDate) - new Date(a.pubDate)
    })[0]
  }

  /**
   * @param {Object<string, any>} response
   */
  static getCharsetFromResponse (response) {
    const headers = response.headers
    const contentType = headers['content-type']
    if (!contentType) {
      return null
    }
    const match = /charset(?:=?)(.*)(?:$|\s)/ig.exec(contentType)
    if (match && match[1]) {
      return match[1]
    }
    return null
  }
}

module.exports = FeedFetcher
