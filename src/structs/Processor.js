const path = require('path')
const fork = require('child_process').fork

class Processor {
  constructor () {
    this.process = fork(path.join(__dirname, '..', 'util', 'processor.js'))
    this.free = true
  }

  get available () {
    return this.free
  }

  lock () {
    this.free = false
  }

  release () {
    this.free = true
    this.process.removeAllListeners()
  }

  on (...args) {
    return this.process.on(...args)
  }

  send (...args) {
    return this.process.send(...args)
  }
}

module.exports = Processor
