/**
 * @this import('mongoose').DocumentQuery
 */
async function findOneAndUpdate () {
  const current = this.model.findOne(this.getQuery())
  if (current.id !== this.id) {
    throw new Error('ID cannot be changed')
  }
}

/**
 * @this import('mongoose').MongooseDocument
 */
async function remove () {
  /**
   * List of feed object IDs
   * @type {string[]}
   */
  const feeds = this.feeds
  if (feeds && feeds.length > 0) {
    await Promise.all(feeds.map(id => this.model('Feed').findByIdAndDelete(id)))
  }
}

module.exports = {
  findOneAndUpdate,
  remove
}
