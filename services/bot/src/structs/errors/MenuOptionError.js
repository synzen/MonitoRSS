class MenuOptionError extends Error {
  constructor (...params) {
    super(...params)

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MenuOptionError)
    }
  }
}

module.exports = MenuOptionError
