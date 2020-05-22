const middleware = require('../../../models/middleware/Feed.js')

describe('Unit::models/middleware/Feed', function () {
  describe('validate', function () {
    it('calls the right Model', async function () {
      const model = jest.fn(() => ({
        findById: () => ({ exec: jest.fn(() => 1) })
      }))
      await middleware.validate({ model })()
      expect(model).toHaveBeenCalledWith('feed')
    })
    it('throws an error if guild tries to change', async function () {
      const guild = 'wte4ry'
      const exec = jest.fn(() => ({ guild }))
      const model = jest.fn(() => ({
        findById: () => ({ exec })
      }))
      const Doc = {
        guild: guild + 1
      }
      await expect(middleware.validate({ model }).bind(Doc)())
        .rejects.toThrowError('Guild cannot be changed')
    })
    it('does not throw an error for all correct conditions', async function () {
      const guild = 'wte4ry'
      const exec = jest.fn(async () => ({ guild }))
      const model = jest.fn(() => ({
        findById: () => ({ exec })
      }))
      const Doc = {
        guild
      }
      await expect(middleware.validate({ model }).bind(Doc)())
        .resolves.toBeUndefined()
    })
  })
})
