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
    this.pool.splice(this.pool.indexOf(processor), 1)
    this.log.debug(`Killed processor, pid ${processor.process.pid}`)
  }

  killAll () {
    this.pool.forEach(processor => this.kill(processor))
  }
}

module.exports = ProcessorPool
