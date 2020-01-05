const middleware = require('../../../models/middleware/Feed.js')

describe('Unit::models/middleware/Feed', function () {
  describe('validate', function () {
    it('calls the right Model', async function () {
      const model = jest.fn(() => ({
        findById: () => ({ exec: jest.fn(() => 1) })
      }))
      const Doc = {
        model
      }
      await middleware.validate.bind(Doc)()
      expect(model).toHaveBeenCalledWith('Feed')
    })
    it('throws an error if guild tries to change', async function () {
      const guild = 'wte4ry'
      const exec = jest.fn(() => ({ guild }))
      const model = jest.fn(() => ({
        findById: () => ({ exec })
      }))
      const Doc = {
        model,
        guild: guild + 1
      }
      await expect(middleware.validate.bind(Doc)())
        .rejects.toThrowError('Guild cannot be changed')
    })
    it('does not throw an error for all correct conditions', async function () {
      const guild = 'wte4ry'
      const exec = jest.fn(async () => ({ guild }))
      const model = jest.fn(() => ({
        findById: () => ({ exec })
      }))
      const Doc = {
        model,
        guild
      }
      await expect(middleware.validate.bind(Doc)())
        .resolves.toBeUndefined()
    })
  })
})
