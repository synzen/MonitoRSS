const Format = require('../../../structs/db/Format.js')

describe('Unit::structs/db/Format', function () {
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
  describe('static isPopulatedEmbedField', function () {
    afterEach(function () {
      jest.restoreAllMocks()
    })
    it('returns false for no field', function () {
      expect(Format.isPopulatedEmbedField())
        .toBeFalsy()
    })
    it('false for no name or value', function () {
      expect(Format.isPopulatedEmbedField({ name: 1 }))
        .toBeFalsy()
      expect(Format.isPopulatedEmbedField({ value: 1 }))
        .toBeFalsy()
      expect(Format.isPopulatedEmbedField({}))
        .toBeFalsy()
    })
    it('returns true when both exists', function () {
      expect(Format.isPopulatedEmbedField({ name: 1, value: 1 }))
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
        expect(Format.isPopulatedEmbed(embed))
          .toBeTruthy()
      }
      const embedWithFields = {
        fields: [{}]
      }
      jest.spyOn(Format, 'isPopulatedEmbedField')
        .mockReturnValueOnce(true)
      expect(Format.isPopulatedEmbed(embedWithFields))
        .toBeTruthy()
    })
    it('returns false for unfilled embeds', function () {
      expect(Format.isPopulatedEmbed({}))
        .toBeFalsy()
      expect(Format.isPopulatedEmbed({ fields: [] }))
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
      jest.spyOn(Format, 'isPopulatedEmbedField')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
      Format.isPopulatedEmbed(embed, true)
      expect(embed.fields).toHaveLength(1)
      expect(embed.fields[0]).toEqual({ foo: 1 })
    })
  })
  describe('pruneEmbeds', function () {
    it('splices correct embeds', function () {
      const embeds = [{}, {}, {}, { jack: 1 }]
      const format = new Format()
      format.embeds = embeds
      jest.spyOn(Format, 'isPopulatedEmbed')
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
      const format = new Format()
      jest.spyOn(format, 'pruneEmbeds').mockReturnValue()
      await format.validate()
      expect(format.pruneEmbeds).toHaveBeenCalledTimes(1)
    })
    it('throws an error for invalid timestamp in an embed', function () {
      const format = new Format()
      format.embeds = [{ timestamp: 'o' }]
      jest.spyOn(format, 'pruneEmbeds').mockReturnValue()
      return expect(format.validate())
        .rejects.toThrowError(new Error('Timestamp can only be article or now'))
    })
  })
})
