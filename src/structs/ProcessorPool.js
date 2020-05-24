const Processor = require('./Processor.js')
const createLogger = require('../util/logger/create.js')

class ProcessorPool {
  constructor (logMarker) {
    /**
     * @type {import('./Processor.js')[]}
     */
    this.pool = []
    this.log = createLogger(logMarker)
  }

  create () {
    const processor = new Processor()
    this.log.debug(`Created new processor, pid ${processor.process.pid}`)
    this.pool.push(processor)
    return processor
  }

  get () {
    this.log.debug('Attempting to find a free processor')
    const found = this.pool.find(p => p.available)
    if (!found) {
      const created = this.create()
      this.log.debug('Unable to find a free processor, created a new one')
      created.lock()
      return created
    }
    this.log.debug(`Found a free processor ${found.process.pid}`)
    found.lock()
    return found
  }

  /**
   * @param {import('./Processor.js')} processor
   */
  release (processor) {
    processor.release()
    this.log.debug(`Released processor, pid ${processor.process.pid}`)
  }

  /**
   * @param {import('./Processor.js')} processor
   */
  kill (processor) {
    processor.release()
    processor.kill()
    const index = this.pool.indexOf(processor)
    this.pool.splice(index, 1)
    this.log.debug(`Killed processor at index ${index}, pid ${processor.process.pid}`)
  }

  killAll () {
    for (let i = this.pool.length - 1; i >= 0; --i) {
      const processor = this.pool[i]
      this.kill(processor)
    }
    this.log.debug('Killed all processors')
  }
}

module.exports = ProcessorPool
