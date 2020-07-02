process.env.TEST_ENV = true
const FilteredFormatModel = require('../../../models/FilteredFormat.js')
const FilteredFormat = require('../../../structs/db/FilteredFormat.js')
const embedSchema = require('../../../models/common/Embed.js')

jest.mock('../../../config.js')

describe('Unit::structs/db/FilteredFormat', function () {
  const keys = Object.keys(embedSchema)
  keys.splice(keys.indexOf('_id'), 1)
  keys.splice(keys.indexOf('fields'), 1)
  const initData = {
    feed: '123b',
    text: 'qawed'
  }
  beforeEach(() => {
    jest.restoreAllMocks()
  })
  describe('constructor', function () {
    it('throws for missing feed', function () {
      expect(() => new FilteredFormat({})).toThrow('feed is undefined')
    })
    it('does not throw for populated text', function () {
      const data = {
        feed: '1234345y',
        text: 'asedg'
      }
      expect(() => new FilteredFormat(data)).not.toThrow()
    })
    it('does not throw for populated embed', function () {
      const data = {
        feed: '1234345y',
        embeds: [{
          description: 'sewgt'
        }]
      }
      expect(() => new FilteredFormat(data)).not.toThrow()
    })
    it('does not throw for unpopulated text and embed', function () {
      const data = {
        feed: '1234345y',
        embeds: []
      }
      expect(() => new FilteredFormat(data)).toThrow('text or embeds must be populated')
    })
  })
  describe('static isPopulatedEmbedField', function () {
    afterEach(function () {
      jest.restoreAllMocks()
    })
    it('returns false for no field', function () {
      expect(FilteredFormat.isPopulatedEmbedField())
        .toBeFalsy()
    })
    it('false for no name or value', function () {
      expect(FilteredFormat.isPopulatedEmbedField({ name: 1 }))
        .toBeFalsy()
      expect(FilteredFormat.isPopulatedEmbedField({ value: 1 }))
        .toBeFalsy()
      expect(FilteredFormat.isPopulatedEmbedField({}))
        .toBeFalsy()
    })
    it('returns true when both exists', function () {
      expect(FilteredFormat.isPopulatedEmbedField({ name: 1, value: 1 }))
        .toBeTruthy()
    })
  })
  describe('static isPopulatedEmbed', function () {
    it('returns true for filled embeds', function () {
      for (const key of keys) {
        const embed = {
          [key]: 'abc',
          fields: []
        }
        expect(FilteredFormat.isPopulatedEmbed(embed))
          .toBeTruthy()
      }
      const embedWithFields = {
        fields: [{}]
      }
      jest.spyOn(FilteredFormat, 'isPopulatedEmbedField')
        .mockReturnValueOnce(true)
      expect(FilteredFormat.isPopulatedEmbed(embedWithFields))
        .toBeTruthy()
    })
    it('returns false for unfilled embeds', function () {
      expect(FilteredFormat.isPopulatedEmbed({}))
        .toBeFalsy()
      expect(FilteredFormat.isPopulatedEmbed({ fields: [] }))
        .toBeFalsy()
    })
    it('splices the correct fields', function () {
      const embed = {
        fields: [{
          foo: 1
        }, {
          bar: 2
        }, {
          baz: 3
        }]
      }
      jest.spyOn(FilteredFormat, 'isPopulatedEmbedField')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
      FilteredFormat.isPopulatedEmbed(embed, true)
      expect(embed.fields).toHaveLength(1)
      expect(embed.fields[0]).toEqual({ foo: 1 })
    })
  })
  describe('pruneEmbeds', function () {
    it('splices correct embeds', function () {
      const embeds = [{}, {}, {}, { jack: 1 }]
      const format = new FilteredFormat({ ...initData })
      format.embeds = embeds
      jest.spyOn(FilteredFormat, 'isPopulatedEmbed')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
      FilteredFormat.pruneEmbeds(format.embeds)
      expect(format.embeds).toEqual([{ jack: 1 }])
    })
  })
  describe('validate', function () {
    it('calls pruneEmbeds', async function () {
      const format = new FilteredFormat({
        ...initData
      })
      format.embeds = []
      const spy = jest.spyOn(FilteredFormat, 'pruneEmbeds').mockReturnValue()
      await format.validate()
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it('does not throw if no embeds specified', async function () {
      const format = new FilteredFormat({
        ...initData
      })
      format.embeds = undefined
      const spy = jest.spyOn(FilteredFormat, 'pruneEmbeds').mockReturnValue()
      await format.validate()
      expect(spy).toHaveBeenCalledTimes(0)
    })
    it('throws an error for invalid timestamp in an embed', function () {
      const format = new FilteredFormat({ ...initData })
      format.embeds = [{ timestamp: 'o' }]
      jest.spyOn(FilteredFormat, 'pruneEmbeds').mockReturnValue()
      return expect(format.validate())
        .rejects.toThrowError(new Error('Timestamp can only be article or now'))
    })
  })
  describe('static get Model', function () {
    it('returns the right model', function () {
      expect(FilteredFormat.Model).toEqual(FilteredFormatModel.Model)
    })
  })
})
