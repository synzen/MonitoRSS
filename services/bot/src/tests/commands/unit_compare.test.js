const compare = require('../../commands/compare')

describe('commands/compare', () => {
  describe('getValidInputs', () => {
    it('returns the the properties correctly', () => {
      const input = 'rss.compare +title -description +author +date'
      const parts = compare.getValidInputs(input)
      expect(parts).toEqual([
        '+title',
        '-description',
        '+author',
        '+date'
      ])
    })
    it('ignores invalid input', () => {
      const input = 'rss.compare +title description author       +date'
      const parts = compare.getValidInputs(input)
      expect(parts).toEqual([
        '+title',
        '+date'
      ])
    })
    it('ignores duplicates', () => {
      const input = 'rss.compare +title +date +title'
      const parts = compare.getValidInputs(input)
      expect(parts).toEqual([
        '+title',
        '+date'
      ])
    })
  })
})
