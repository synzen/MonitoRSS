const FilteredFormatModel = require('../../../models/FilteredFormat.js').model
const FilteredFormat = require('../../../structs/db/FilteredFormat.js')

describe('Unit::structs/db/FilteredFormat', function () {
  const keys = [
    'title',
    'description',
    'color',
    'footerText',
    'authorName',
    'thumbnailUrl',
    'imageUrl',
    'timestamp'
  ]
  const initData = {
    feed: '123b'
  }
  describe('constructor', function () {
    it('throws for missing feed', function () {
      expect(() => new FilteredFormat({})).toThrow('feed is undefined')
    })
    it('does not throw for appropriate data', function () {
      const data = {
        feed: '1234345y'
      }
      expect(() => new FilteredFormat(data)).not.toThrow()
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
      format.pruneEmbeds()
      expect(format.embeds).toEqual([{ jack: 1 }])
    })
  })
  describe('validate', function () {
    it('calls pruneEmbeds', async function () {
      const format = new FilteredFormat({ ...initData })
      jest.spyOn(format, 'pruneEmbeds').mockReturnValue()
      await format.validate()
      expect(format.pruneEmbeds).toHaveBeenCalledTimes(1)
    })
    it('throws an error for invalid timestamp in an embed', function () {
      const format = new FilteredFormat({ ...initData })
      format.embeds = [{ timestamp: 'o' }]
      jest.spyOn(format, 'pruneEmbeds').mockReturnValue()
      return expect(format.validate())
        .rejects.toThrowError(new Error('Timestamp can only be article or now'))
    })
  })
  describe('static get Model', function () {
    it('returns the right model', function () {
      expect(FilteredFormat.Model).toEqual(FilteredFormatModel)
    })
  })
})
