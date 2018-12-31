const FeedParser = require('feedparser')
const iconv = require('iconv-lite')
const config = require('../config.js')

class DecodedFeedParser extends FeedParser {
  constructor (options, url) {
    super(options)
    this.url = url
  }

  _transform (chunk, encoding, done) {
    if (!config.feeds.decode || !config.feeds.decode[this.url]) this.stream.write(chunk)
    else {
      const encoding = config.feeds.decode[this.url]
      this.stream.write(iconv.decode(chunk, encoding === 'auto' ? require('chardet').detect(chunk) : encoding)) // Assumes that the encoding specified is valid, and will not check via iconv.encodingExists()
    }
    done()
  }
}

module.exports = DecodedFeedParser
