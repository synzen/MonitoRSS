const Base = require('./Base.js')

class FilterBase extends Base {
  constructor () {
    super()

    this.filters = this.getField('filters', {})
  }

  toObject () {
    if (Base.isMongoDatabase) {
      const map = new Map()
      const filters = this.filters
      for (const key in filters) {
        map.set(key, filters[key])
      }
      return {
        filters: map
      }
    }
    return {
      filters: this.filters
    }
  }
}
module.exports = FilterBase
