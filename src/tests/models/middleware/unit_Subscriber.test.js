const middleware = require('../../../models/middleware/Subscriber.js')

describe('Unit::models/middleware/Subscriber', function () {
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
      expect(model).toHaveBeenCalledWith('Subscriber')
    })
    it('throws an error if profile not found', function () {
      const model = jest.fn(() => ({
        findById: () => ({ exec: () => null })
      }))
      const Doc = {
        _id: 123,
        model,
        feed: 'abc'
      }
      return expect(middleware.validate.bind(Doc)())
        .rejects.toThrowError(new Error(`Subscriber's specified feed ${Doc.feed} was not found`))
    })
    it('throws an error if feed tries to change', async function () {
      const feed = 'wte4ry'
      const exec = jest.fn(() => ({ feed }))
      const model = jest.fn(() => ({
        findById: () => ({ exec })
      }))
      const Doc = {
        model,
        feed: feed + 1
      }
      await expect(middleware.validate.bind(Doc)())
        .rejects.toThrowError('Feed cannot be changed')
    })
    it('does not throw an error for all correct conditions', async function () {
      const feed = 'wte4ry'
      const exec = jest.fn(async () => ({ feed }))
      const model = jest.fn(() => ({
        findById: () => ({ exec })
      }))
      const Doc = {
        model,
        feed
      }
      await expect(middleware.validate.bind(Doc)())
        .resolves.toBeUndefined()
    })
  })
})
