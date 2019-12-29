const Format = require('../../../structs/db/Format.js')

describe('Int::structs/db/Format', function () {
  describe('pruneEmbeds', function () {
    it('works with fields', function () {
      const embeds = [{
        fields: [{}, {
          name: 'abc'
        }, {
          name: 'foo',
          value: 'bar'
        }]
      }]
      const format = new Format({
        embeds
      })
      format.pruneEmbeds()
      expect(format.embeds).toEqual([{
        fields: [{
          name: 'foo',
          value: 'bar'
        }]
      }])
    })
    it('works with non-field', function () {
      const embeds = [{}, {
        title: 'dodat'
      }, {}]
      const format = new Format({
        embeds
      })
      format.pruneEmbeds()
      expect(format.embeds).toEqual([{
        title: 'dodat'
      }])
    })
  })
})
