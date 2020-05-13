const Processor = require('./Processor.js')

class ProcessorPool {
  static createProcessor () {
    const processor = new Processor()
    this.pool.push(processor)
    return processor
  }

  static getProcessor () {
    const found = this.pool.find(p => p.available)
    if (!found) {
      const created = this.createProcessor()
      created.lock()
      return created
    }
    found.lock()
    return found
  }

  /**
   * @param {import('./Processor')} processor
   */
  static releaseProcessor (processor) {
    processor.release()
  }
}

/**
 * @type {import('./Processor')[]}
 */
ProcessorPool.pool = []

module.exports = ProcessorPool
