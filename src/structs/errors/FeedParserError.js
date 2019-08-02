class FeedParserError extends Error {
  constructor (code, ...params) {
    super(...params)

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FeedParserError)
    }

    if (code) this.code = code
  }
}

module.exports = FeedParserError
