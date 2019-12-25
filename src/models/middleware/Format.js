/**
 * @this import('mongoose').MongooseDocument
 */
async function checkEmptyField () {
  const { name, value } = this
  if (!name || !value) {
    await this.remove()
  }
}

/**
 * @this import('mongoose').MongooseDocument
 */
async function checkEmptyEmbed () {
  const keys = [
    'title',
    'description',
    'color',
    'footerText',
    'authorName',
    'thumbnailUrl',
    'imageUrl',
    'timestamp'
  ]
  let filled = false
  for (const key of keys) {
    filled = filled || !!this[key]
  }
  if (this.fields.length > 0) {
    filled = true
  }
  if (!filled) {
    await this.remove()
  } else if (this.timestamp && this.timestamp !== 'article' && this.timestamp !== 'now') {
    throw new Error('Timestamp can only be article or now')
  }
}

module.exports = {
  checkEmptyField,
  checkEmptyEmbed
}
