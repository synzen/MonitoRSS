const fieldSchema = {
  _id: false,
  name: String,
  value: String,
  inline: Boolean
}

const embedSchema = {
  _id: false,
  title: String,
  description: String,
  url: String,
  color: Number,
  footerText: String,
  footerIconURL: String,
  authorName: String,
  authorIconURL: String,
  authorURL: String,
  thumbnailURL: String,
  imageURL: String,
  timestamp: String,
  fields: [fieldSchema]
}

module.exports = embedSchema
