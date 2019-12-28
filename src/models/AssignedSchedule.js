const mongoose = require('mongoose')

const schema = mongoose.Schema({
  _id: String,
  feed: {
    type: mongoose.Types.ObjectId,
    index: true,
    unique: true
  },
  guild: String,
  shard: Number,
  link: String,
  schedule: String
})

exports.model = mongoose.model('assigned_schedules', schema)
