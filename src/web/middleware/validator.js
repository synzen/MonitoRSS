const { validationResult } = require('express-validator')
const formatter = require('../util/validatorFormatter.js')
const createError = require('../util/createError.js')

/**
 * @param {import('express-validator').ValidationChain[]} validations
 */
function validator (validations) {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async function middleware (req, res, next) {
    try {
      const promises = validations.map(validator => validator.run(req))
      const result = await Promise.all(promises)
      const errors = validationResult(result).formatWith(formatter)
      if (errors.isEmpty()) {
        return next()
      }
      const response = createError(422, 'Validation error', errors.array())
      res.status(422).json(response)
    } catch (err) {
      next(err)
    }
  }
  return middleware
}

module.exports = validator
