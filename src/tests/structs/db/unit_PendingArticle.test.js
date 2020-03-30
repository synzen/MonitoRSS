process.env.TEST_ENV = true
const PendingArticle = require('../../../structs/db/PendingArticle.js')

jest.mock('../../../config.js')

describe('Unit::structs/db/PendingArticle', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  describe('constructor', function () {
    it('throws for undefined article', function () {
      const data = {}
      expect(() => new PendingArticle(data))
        .toThrow(new TypeError('article is undefined'))
    })
  })
  describe('toObject', function () {
    it('returns correctly', function () {
      const data = {
        article: {
          a: '3e45y'
        }
      }
      const kv = new PendingArticle({ ...data })
      kv.article = data.article
      const returned = kv.toObject()
      expect(returned).toEqual(data)
    })
  })
  describe('static deleteID', function () {
    it('calls delete if pendign article found', async function () {
      const mockPendingArticle = {
        delete: jest.fn()
      }
      jest.spyOn(PendingArticle, 'get').mockResolvedValue(mockPendingArticle)
      await PendingArticle.deleteID('asfdeg')
      expect(mockPendingArticle.delete).toHaveBeenCalled()
    })
    it('does not reject if pending article not found', async function () {
      jest.spyOn(PendingArticle, 'get').mockResolvedValue(null)
      await PendingArticle.deleteID('asfdeg')
    })
    it('does not reject if no id passed in', async function () {
      await PendingArticle.deleteID()
    })
  })
})
