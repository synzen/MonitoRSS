class RequestError extends Error {
  constructor (code, message, cloudflare = false) {
    super(message)

    this.cloudflare = cloudflare
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RequestError)
    }
    this.code = code
  }
}

module.exports = RequestError
