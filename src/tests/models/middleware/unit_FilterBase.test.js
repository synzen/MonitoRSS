const middleware = require('../../../models/middleware/FilterBase.js')

describe('Unit::models/middleware/FilterBase', function () {
  describe('checkEmptyFilters', function () {
    it('deletes empty arrays', async function () {
      const bind = {
        filters: new Map([
          ['title', ['tit1', 'tit2']],
          ['author', []],
          ['random', []],
          ['description', ['val 1']]
        ])
      }
      await middleware.checkEmptyFilters.bind(bind)()
      expect(bind.filters.get('author')).toEqual(undefined)
      expect(bind.filters.get('random')).toEqual(undefined)
      expect(bind.filters.get('title')).toBeDefined()
      expect(bind.filters.get('description')).toBeDefined()
    })
  })
})
