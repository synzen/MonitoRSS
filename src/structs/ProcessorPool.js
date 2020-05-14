const Processor = require('./Processor.js')

class ProcessorPool {
  constructor () {
    /**
     * @type {import('./Processor.js')[]}
     */
    this.pool = []
  }

  create () {
    const processor = new Processor()
    this.pool.push(processor)
    return processor
  }

  get () {
    const found = this.pool.find(p => p.available)
    if (!found) {
      const created = this.create()
      created.lock()
      return created
    }
    found.lock()
    return found
  }

  /**
   * @param {import('./Processor')} processor
   */
  release (processor) {
    processor.release()
  }

  killUnavailables () {
    const unavailables = this.pool.filter(p => !p.available)
    unavailables.map(p => p.kill())
    for (const p of unavailables) {
      p.kill()
      this.pool.splice(this.pool.indexOf(p), 1)
    }
  }
}

module.exports = ProcessorPool
