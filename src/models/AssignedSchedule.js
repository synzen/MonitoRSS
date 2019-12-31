const mongoose = require('mongoose')
const Version = require('./common/Version')

const schema = new mongoose.Schema({
  feed: {
    type: mongoose.Types.ObjectId,
    index: true,
    unique: true
  },
  guild: String,
  shard: Number,
  url: String,
  schedule: String
})

schema.add(Version)

exports.model = mongoose.model('assigned_schedules', schema)
