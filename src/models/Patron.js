const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  _id: String,
  statusOverride: String,
  status: String,
  lastCharge: Date,
  pledgeLifetime: {
    type: Number,
    required: true
  },
  pledge: {
    type: Number,
    required: true
  },
  name: String,
  discord: String,
  email: String
})

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
