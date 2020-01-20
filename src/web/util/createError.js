function createError (status, message, errors) {
  const error = {
    status,
    message
  }
  if (errors && errors.length > 0) {
    error.errors = errors
  }
  return error
}

module.exports = createError
