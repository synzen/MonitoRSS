const Base = require('./Base.js')

class FilterBase extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    this.filters = this.getField('filters', {})
  }

  pruneFilters () {
    const filters = this.filters
    for (const key in filters) {
      const value = filters[key]
      if (!Array.isArray(value) || filters[key].length === 0) {
        delete filters[key]
      }
    }
  }

  validate () {
    this.pruneFilters()
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
