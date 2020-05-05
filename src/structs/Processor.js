const path = require('path')
const fork = require('child_process').fork

class Processor {
  constructor () {
    this.process = fork(path.join(__dirname, '..', 'util', 'processor.js'))
  }
}

module.exports = Processor
