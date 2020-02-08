class FilterRegex {
  /**
   * @param {string} content
   * @param {boolean} regex
   */
  constructor (content) {
    /**
     * The original filter input
     * @type {string}
     */
    this.content = content
  }

  /**
   * Whether the filter content is contained in a string
   * @param {string} string
   */
  passes (string) {
    const regex = new RegExp(this.content, 'i')
    return string.search(regex) !== -1
  }
}

export default FilterRegex
