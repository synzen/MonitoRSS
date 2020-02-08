/**
 * @this import('mongoose').MongooseDocument
 */
async function validate () {
  const feed = await this.model('Feed').findById(this.feed).exec()
  if (!feed) {
    throw new Error(`Subscriber's specified feed ${this.feed} was not found`)
  }
  const current = await this.model('Subscriber').findById(this._id).exec()
  // If current doesn't exist, then it's a new subscriber
  if (current && !current.feed.equals(this.feed)) {
    throw new Error('Feed cannot be changed')
  }
}

module.exports = {
  validate
}
