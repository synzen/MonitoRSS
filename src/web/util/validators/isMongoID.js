const mongoose = require('mongoose')

function isMongoID (val) {
  return mongoose.Types.ObjectId.isValid(val)
}

module.exports = isMongoID
