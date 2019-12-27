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

  /**
   * Get the array index of the filter in a category
   * @param {string} category
   * @param {string} value
   * @returns {number}
   */
  getFilterIndex (category, value) {
    value = value.toLowerCase()
    const filters = this.filters[category]
    const index = !filters ? -1 : filters.indexOf(value)
    return index !== -1
  }

  /**
   * Remove a filter from a category
   * @param {string} category
   * @param {string} value
   */
  async removeFilter (category, value) {
    value = value.toLowerCase()
    const index = this.getFilterIndex(category, value)
    if (index === -1) {
      throw new Error(`"${value}" does not exist`)
    }
    this.filters[category].splice(index, 1)
    return this.save()
  }

  /**
   * Add a filter to a category
   * @param {string} category
   * @param {string} value
   */
  async addFilter (category, value) {
    value = value.toLowerCase()
    const index = this.getFilterIndex(category, value)
    if (index === -1) {
      throw new Error(`"${value} already exists"`)
    }
    const filters = this.filters
    if (!filters[category]) {
      filters[category] = []
    }
    filters[category].push(value.toLowerCase())
    return this.save()
  }

  /**
   * Add multiple filters to a category
   * @param {string} category
   * @param {string[]} values
   */
  async addFilters (category, values) {
    values = values.map(value => value.toLowerCase())
    const filters = this.filters
    for (const value of values) {
      const index = this.getFilterIndex(category, value)
      if (index === -1) {
        throw new Error(`"${value}" already exists`)
      }
    }
    if (!filters[category]) {
      filters[category] = []
    }
    filters[category] = filters[category].concat(values)
    return this.save()
  }

  /**
   * Remove all filters
   */
  async removeFilters () {
    this.filters = {}
    return this.save()
  }

  /**
   * If any filters exist
   * @returns {boolean}
   */
  hasFilters () {
    return Object.keys(this.filters).length > 0
  }
}

module.exports = FilterBase
