/**
 * @param {import('express-validator').ValidationError} error 
 */
function formatter (error) {
  return {
    param: error.param,
    message: error.msg
  }
}

module.exports = formatter
