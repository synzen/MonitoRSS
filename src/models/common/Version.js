const fs = require('fs')
const path = require('path')
const version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'))).version

module.exports = {
  addedAt: {
    type: Date,
    default: Date.now
  },
  version: {
    type: String,
    default: version
  }
}
