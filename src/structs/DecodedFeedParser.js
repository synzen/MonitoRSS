const FeedParser = require('feedparser')
const iconv = require('iconv-lite')
const getConfig = require('../config.js').get

class DecodedFeedParser extends FeedParser {
  constructor (options, url, charset) {
    super(options)
    this.url = url
    this.charset = charset
  }

  _transform (chunk, encoding, done) {
    const config = getConfig()
    const charset = config.feeds.decode[this.url] || this.charset
    if (/utf-*8/i.test(charset) || !charset || !iconv.encodingExists(charset)) {
      this.stream.write(chunk)
    } else {
      // Assumes that the encoding specified is valid, and will not check via iconv.encodingExists()
      this.stream.write(iconv.decode(chunk, charset))
    }
    done()
  }
}

module.exports = DecodedFeedParser
