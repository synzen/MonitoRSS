const Base = require('../../../../structs/db/Base.js')
const MockModel = require('./MockModel.js')

class BasicBase extends Base {
  static get Model () {
    return MockModel
  }
}

module.exports = BasicBase
