class Filter {
  /**
   * @param {string} content
   */
  constructor (content) {
    /**
     * The original filter input
     * @type {string}
     */
    this.content = content.toLowerCase()

    /**
     * Filter content without modifiers
     * @type {string}
     */
    this.searchTerm = this.parseWord(this.content)
  }

  /**
   * @param {string} string
   */
  static escapeRegex (string) {
    return string.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
  }

  /**
   * Remove modifiers from the filter content
   * @returns {string}
   */
  parseWord () {
    const { content } = this
    if (content.startsWith('\\~') || content.startsWith('\\!')) {
      return content.slice(1, content.length)
    }
    return content.replace(/^(~!|!~|!|~)/, '')
  }

  /**
   * Whether the filter is modified to be broad
   * @returns {boolean}
   */
  get broad () {
    const { content } = this
    return content.startsWith('~') || content.startsWith('!~') || content.startsWith('~!')
  }

  /**
   * Whether the filter is modified to be inverted
   * @returns {boolean}
   */
  get inverted () {
    const { content } = this
    return content.startsWith('!') || content.startsWith('!~') || content.startsWith('~!')
  }

  /**
   * Whether the parsed filter content is contained in a string
   * @param {string} string
   */
  foundIn (string) {
    if (this.broad) {
      return string.toLowerCase().includes(this.searchTerm)
    } else {
      const regex = new RegExp(`(\\s|^)${Filter.escapeRegex(this.searchTerm)}(\\s|$)`, 'i')
      return string.search(regex) !== -1
    }
  }

  /**
   * @param {string} string
   */
  passes (string) {
    const found = this.foundIn(string)
    if (this.inverted) {
      return !found
    } else {
      return found
    }
  }
}

export default Filter
