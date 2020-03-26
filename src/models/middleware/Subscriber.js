/**
 * @param {import('mongoose').Connection} connection
 */
function validate (connection) {
  /**
   * @this import('mongoose').MongooseDocument
   */
  async function run () {
    const feed = await connection.model('feed').findById(this.feed).exec()
    if (!feed) {
      throw new Error(`Subscriber's specified feed ${this.feed} was not found`)
    }
    const current = await connection.model('subscriber').findById(this._id).exec()
    // If current doesn't exist, then it's a new subscriber
    if (current && !current.feed.equals(this.feed)) {
      throw new Error('Feed cannot be changed')
    }
  }
  return run
}

module.exports = {
  validate
}
