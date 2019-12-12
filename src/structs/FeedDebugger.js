class FeedDebugger {
  /**
   * Object of IDs as keys and URLs as values
   *
   * @param {Object<string, string>} relations
   */
  constructor (relations = {}) {
    this._urls = new Set()
    this._relations = relations
  }

  /**
   * @param {string} id
   * @param {string} url
   */
  add (id, url) {
    this._urls.add(url)
    this._relations[id] = url
  }

  /**
   * @param {string} id
   */
  remove (id) {
    const foundUrl = this._relations[id]
    if (!foundUrl) {
      return
    }
    this._urls.delete(foundUrl)
    delete this._relations[id]
  }

  /**
   * @param {string} id
   */
  hasID (id) {
    return !!this._relations[id]
  }

  /**
   * @param {string} url
   */
  hasURL (url) {
    return this._urls.has(url)
  }

  serialize () {
    return this._relations
  }
}

const instance = new FeedDebugger()

module.exports = instance
