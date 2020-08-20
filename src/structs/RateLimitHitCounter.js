const EventEmitter = require('events').EventEmitter

/**
 * Emits a limitReached event when more than 100 hit
 * calls are called within a minute
 */
class RateLimitCounter extends EventEmitter {
  constructor () {
    super()
    this.hits = 0
    setInterval(() => {
      this.clear()
    }, 1000 * 60) // Reset every minute
  }

  hit () {
    this.hits++
    if (this.hits > 100) {
      this.emit('limitReached')
    }
  }

  clear () {
    this.hits = 0
  }
}

module.exports = RateLimitCounter
