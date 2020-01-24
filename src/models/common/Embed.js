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
  authorName: String,
  authorIconUrl: String,
  authorUrl: String,
  thumbnailUrl: String,
  imageUrl: String,
  timestamp: String,
  fields: [fieldSchema]
}

module.exports = embedSchema
