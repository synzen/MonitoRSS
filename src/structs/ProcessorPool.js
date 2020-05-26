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
    const created = this.create()
    return created
  }

  /**
   * @param {import('./Processor.js')} processor
   */
  kill (processor) {
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
