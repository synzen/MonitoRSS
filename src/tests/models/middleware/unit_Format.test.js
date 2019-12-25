const middleware = require('../../../models/middleware/Format.js')

describe('Unit::models/middleware/Format', function () {
  describe('checkEmptyField', function () {
    it('calls remove appropriately', async function () {
      const remove = jest.fn()
      const bind = {
        name: '',
        value: '',
        remove
      }
      const fun = middleware.checkEmptyField.bind(bind)
      await fun()
      expect(remove).toHaveBeenCalled()
      remove.mockReset()
      bind.name = '123'
      await fun()
      expect(remove).toHaveBeenCalled()
      remove.mockReset()
      bind.name = ''
      bind.value = '123'
      await fun()
      expect(remove).toHaveBeenCalled()
      remove.mockReset()
      bind.name = 'abc'
      bind.value = '123'
      await fun()
      expect(remove).not.toHaveBeenCalled()
    })
  })
  describe('checkEmptyEmbed', function () {
    const keys = [
      'title',
      'description',
      'color',
      'footerText',
      'authorName',
      'thumbnailUrl',
      'imageUrl'
      // 'timestamp'
    ]
    it(`doesn't call remove when the embed has properties`, async function () {
      const remove = jest.fn()
      for (const key of keys) {
        const bind = {
          remove,
          [key]: 'abc',
          fields: []
        }
        await middleware.checkEmptyEmbed.bind(bind)()
        expect(remove).not.toHaveBeenCalled()
      }
    })
    it(`doesn't call remove when there are items in embed`, async function () {
      const remove = jest.fn()
      const bind = {
        remove,
        fields: [{}]
      }
      await middleware.checkEmptyEmbed.bind(bind)()
      expect(remove).not.toHaveBeenCalled()
    })
    it(`throws an error if timestamp is invalid`, async function () {
      const remove = jest.fn()
      const bind = {
        remove,
        fields: [{}],
        timestamp: 'article'
      }
      await expect(middleware.checkEmptyEmbed.bind(bind)())
        .resolves.toBeUndefined()
      bind.timestamp = 'abc'
      await expect(middleware.checkEmptyEmbed.bind(bind)())
        .rejects.toThrowError(new Error('Timestamp can only be article or now'))
      bind.timestamp = 'article'
      await expect(middleware.checkEmptyEmbed.bind(bind)())
        .resolves.toBeUndefined()
    })
  })
})
