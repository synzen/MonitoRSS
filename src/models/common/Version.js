const fs = require('fs')
const path = require('path')
const packagePath = path.join(__dirname, '..', '..', '..', 'package.json')
const packageContents = fs.readFileSync(packagePath)
const version = JSON.parse(packageContents).version

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
