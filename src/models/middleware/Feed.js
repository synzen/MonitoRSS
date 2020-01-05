/**
 * @this import('mongoose').MongooseDocument
 */
async function validate () {
  const current = await this.model('Feed').findById(this._id).exec()
  // If current doesn't exist, then it's a new feed
  if (current && current.guild !== this.guild) {
    throw new Error('Guild cannot be changed')
  }
}

module.exports = {
  validate
}
