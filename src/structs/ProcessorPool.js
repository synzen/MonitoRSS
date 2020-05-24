const Processor = require('./Processor.js')
const createLogger = require('../util/logger/create.js')

class ProcessorPool {
  static create () {
    const log = createLogger()
    const processor = new Processor()
    log.debug(`Created new processor, pid ${processor.process.pid}`)
    this.pool.push(processor)
    return processor
  }

  static get () {
    const log = createLogger()
    log.debug('Attempting to find a free processor')
    const found = this.pool.find(p => p.available)
    if (!found) {
      const created = this.create()
      log.debug('Unable to find a free processor, created a new one')
      created.lock()
      return created
    }
    log.debug(`Found a free processor ${found.process.pid}`)
    found.lock()
    return found
  }

  /**
   * @param {import('./Processor.js')} processor
   */
  static release (processor) {
    const log = createLogger()
    processor.release()
    log.debug(`Released processor, pid ${processor.process.pid}`)
  }

  /**
   *
   * @param {import('./Processor.js')} processor
   */
  static kill (processor) {
    const log = createLogger()
    processor.release()
    processor.kill()
    this.pool.splice(this.pool.indexOf(processor), 1)
    log.debug(`Killed processor, pid ${processor.process.pid}`)
  }
}

/**
 * @type {import('./Processor.js')[]}
 */
ProcessorPool.pool = []

module.exports = ProcessorPool
