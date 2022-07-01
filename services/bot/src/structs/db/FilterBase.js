const Base = require('./Base.js')

class FilterBase extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * Regular filters
     * @type {Object<string, string[]>}
     */
    this.filters = this.getField('filters', {})

    /**
     * Regex filters
     * @type {Object<string, string>}
     */
    this.rfilters = this.getField('rfilters', {})
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
    const filtersMap = new Map()
    const rFiltersMap = new Map()
    const filters = this.filters
    const rfilters = this.rfilters
    for (const key in filters) {
      filtersMap.set(key, filters[key])
    }
    for (const key in rfilters) {
      rFiltersMap.set(key, rfilters[key])
    }
    return {
      filters: filtersMap,
      rfilters: rFiltersMap
    }
  }

  toJSON () {
    /**
     * Overwrite the filters map from toObject with the
     * regular object
     */
    return {
      ...this.toObject(),
      filters: this.filters,
      rfilters: this.rfilters
    }
  }

  /**
   * Get the array index of the filter in a category
   * @param {string} category
   * @param {string} value
   * @returns {number}
   */
  getFilterIndex (category, value) {
    value = value.toLowerCase().trim()
    const filters = this.filters[category]
    const index = !filters ? -1 : filters.indexOf(value)
    return index
  }

  /**
   * Remove a filter from a category
   * @param {string} category
   * @param {string} value
   */
  async removeFilter (category, value) {
    value = value.toLowerCase().trim()
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
    value = value.toLowerCase().trim()
    const index = this.getFilterIndex(category, value)
    if (index !== -1) {
      throw new Error(`"${value}" already exists`)
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
    values = values.map(value => value.toLowerCase().trim())
    const filters = this.filters
    for (const value of values) {
      const index = this.getFilterIndex(category, value)
      if (index !== -1) {
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
   * Remove multiple filters from a category
   * @param {string} category
   * @param {string[]} values
   */
  async removeFilters (category, values) {
    const indexes = values.map(value => this.getFilterIndex(category, value))
    const filtered = indexes.filter(index => index !== -1)
    // Sort from highest to lowest
    const sorted = filtered.sort((a, b) => b - a)
    if (sorted.length > 0) {
      for (const index of sorted) {
        this.filters[category].splice(index, 1)
      }
      await this.save()
    }
  }

  /**
   * Remove all filters
   */
  async removeAllFilters () {
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

  /**
   * If any regex filters exist
   * @returns {boolean}
   */
  hasRFilters () {
    return Object.keys(this.rfilters).length > 0
  }
}

module.exports = FilterBase
