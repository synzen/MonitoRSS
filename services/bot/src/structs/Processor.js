const path = require('path')
const fork = require('child_process').fork

class Processor {
  constructor () {
    this.process = fork(path.join(__dirname, '..', 'util', 'processor.js'))
  }

  on (...args) {
    return this.process.on(...args)
  }

  send (...args) {
    return this.process.send(...args)
  }

  kill () {
    this.process.kill()
  }
}

module.exports = Processor
