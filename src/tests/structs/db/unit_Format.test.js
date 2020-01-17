const FormatModel = require('../../../models/Format.js').model
const Format = require('../../../structs/db/Format.js')

describe('Unit::structs/db/Format', function () {
  describe('constructor', function () {
    const initData = {
      feed: 'aqbc',
      text: 'aedtgr'
    }
    it('has no filters and no priority', function () {
      const format = new Format({ ...initData })
      expect(format.filters).toBeUndefined()
      expect(format.priority).toBeUndefined()
    })
  })
  describe('toObject', function () {
    it('returns correctly', function () {
      const data = {
        feed: 'awsfdegtr',
        text: 'aedsgrf',
        embeds: [{
          title: 'hello'
        }]
      }
      const format = new Format(data)
      expect(format.toObject()).toEqual(data)
    })
  })
  describe('toJSON', function () {
    it('returns correctly', function () {
      const data = {
        feed: 'awsfdegtr',
        text: 'aedsgrf',
        embeds: [{
          title: 'hello'
        }]
      }
      const format = new Format(data)
      expect(format.toJSON()).toEqual(data)
    })
  })
  describe('static get Model', function () {
    it('returns the right model', function () {
      expect(Format.Model).toEqual(FormatModel)
    })
  })
})
