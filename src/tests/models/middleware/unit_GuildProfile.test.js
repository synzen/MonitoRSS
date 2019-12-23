const middleware = require('../../../models/middleware/GuildProfile.js')

describe('Unit::models/middleware/Guild', function () {
  describe('findOneAndUpdate', function () {
    it(`throws if the id change`, function () {
      const found = { id: 123 }
      const DocQuery = {
        id: 456,
        model: {
          findOne: jest.fn(() => found)
        },
        getQuery: jest.fn()
      }
      return expect(middleware.findOneAndUpdate.bind(DocQuery)())
        .rejects.toThrowError(new Error('ID cannot be changed'))
    })
    it(`doesn't throw an error if id is same`, function () {
      const found = { id: 123 }
      const DocQuery = {
        id: found.id,
        model: {
          findOne: jest.fn(() => found)
        },
        getQuery: jest.fn()
      }
      return expect(middleware.findOneAndUpdate.bind(DocQuery)())
        .resolves.toBeUndefined()
    })
  })
  describe('remove', function () {
    it('calls findByIdAndDelete the right number of times', async function () {
      const findByIdAndDelete = jest.fn()
      const Doc = {
        model: jest.fn(() => ({
          findByIdAndDelete
        }))
      }
      await middleware.remove.bind(Doc)()
      expect(findByIdAndDelete).not.toHaveBeenCalled()
      Doc.feeds = [1, 2, 3]
      await middleware.remove.bind(Doc)()
      expect(findByIdAndDelete).toHaveBeenCalledTimes(Doc.feeds.length)
      for (const n of Doc.feeds) {
        expect(findByIdAndDelete).toHaveBeenCalledWith(n)
      }
    })
    it('calls the right model', async function () {
      const model = jest.fn(() => ({
        findByIdAndDelete: jest.fn()
      }))
      const Doc = {
        model,
        feeds: ['a']
      }
      await middleware.remove.bind(Doc)()
      expect(model).toHaveBeenCalledWith('Feed')
    })
  })
})
