class BadRequestError extends Error {
  constructor (feedId, ...params) {
    super(...params)
    this.feedId = feedId

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BadRequestError)
    }
  }
}

module.exports = BadRequestError
