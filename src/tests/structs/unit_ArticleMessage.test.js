const ArticleMessage = require('../../structs/ArticleMessage.js')

jest.mock('discord.js')

describe('Unit::ArticleMessage', function () {
  describe('constructor', function () {
    it('throws an error if _delivery is missing', function () {
      expect(() => new ArticleMessage({})).toThrowError()
    })
  })
})
