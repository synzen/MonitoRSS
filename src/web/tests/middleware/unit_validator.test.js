const validator = require('../../middleware/validator.js')
const createError = require('../../util/createError.js')
const { validationResult } = require('express-validator')
const {
  createResponse,
  createNext
} = require('../mocks/express.js')

jest.mock('../../util/validatorFormatter.js')
jest.mock('../../util/createError.js')
jest.mock('express-validator')

const createValidator = () => ({ run: jest.fn() })

describe('Unit::middleware/validator', function () {
  it('runs all the validations', async function () {
    const validations = [
      createValidator(),
      createValidator()
    ]
    const res = createResponse()
    const next = createNext()
    const middleware = validator(validations)
    await middleware({}, res, next)
    expect(validations[0].run).toHaveBeenCalledTimes(1)
    expect(validations[1].run).toHaveBeenCalledTimes(1)
  })
  it('calls next if there are no errors', async function () {
    const validations = [
      createValidator()
    ]
    const res = createResponse()
    const next = createNext()
    validationResult.mockReturnValue({
      formatWith: () => ({
        isEmpty: () => true
      })
    })
    const middleware = validator(validations)
    await middleware({}, res, next)
    expect(next).toHaveBeenCalledWith()
  })
  it('returns 422 if there are errors', async function () {
    const validations = [
      createValidator()
    ]
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    validationResult.mockReturnValue({
      formatWith: () => ({
        isEmpty: () => false,
        array: jest.fn()
      })
    })
    const error = 'wq3trgr'
    createError.mockReturnValue(error)
    const middleware = validator(validations)
    await middleware({}, res, next)
    expect(res.status).toHaveBeenCalledWith(422)
    expect(json).toHaveBeenCalledWith(error)
  })
  it('calls next if there is an error', async function () {
    const error = new Error('fooasfdegrf')
    const errorValidator = createValidator()
    errorValidator.run.mockRejectedValue(error)
    const validations = [
      createValidator(),
      errorValidator
    ]
    const res = createResponse()
    const next = createNext()
    const middleware = validator(validations)
    await middleware({}, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
})
