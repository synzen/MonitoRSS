const log = require('../util/logger.js')

/** @template T */
class DebugData {
  /**
   * @param {T[]} data
   * @param {string} name
   */
  constructor (data = [], name) {
    this.data = new Set()
    this.name = name

    for (const item of data) {
      this.add(item)
    }
  }

  /**
   * @param {T} value
   */
  add (value) {
    log.debug.info(`DataDebugger ${this.name} - Added ${value}`)
    this.data.add(value)
  }

  /**
   * @param {T} value
   */
  remove (value) {
    log.debug.info(`DataDebugger ${this.name} - Removed ${value}`)
    this.data.delete(value)
  }

  /**
   * @param {T} id
   */
  has (value) {
    return this.data.has(value)
  }

  /**
   * @returns {T[]}
   */
  serialize () {
    return Array.from(this.data)
  }
}

module.exports = DebugData
