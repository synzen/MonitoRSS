const mongoose = require('mongoose')

const schema = mongoose.Schema({
  feedID: {
    type: String,
    index: true,
    unique: true
  },
  guildID: String,
  shard: Number,
  link: String,
  schedule: String
})

exports.model = () => mongoose.model('assigned_schedules', schema)
