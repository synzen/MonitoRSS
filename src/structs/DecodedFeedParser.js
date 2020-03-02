const FeedParser = require('feedparser')
const iconv = require('iconv-lite')
const config = require('../config.js')

class DecodedFeedParser extends FeedParser {
  constructor (options, url) {
    super(options)
    this.url = url
  }

  _transform (chunk, encoding, done) {
    if (!config.feeds.decode || !config.feeds.decode[this.url]) {
      this.stream.write(chunk)
    } else {
      const userEncoding = config.feeds.decode[this.url]
      // Assumes that the encoding specified is valid, and will not check via iconv.encodingExists()
      this.stream.write(iconv.decode(chunk, userEncoding))
    }
    done()
  }
}

module.exports = DecodedFeedParser
