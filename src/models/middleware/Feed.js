/**
 * @this import('mongoose').MongooseDocument
 */
async function validate () {
  const profile = await this.model('Guild').findById(this.guild).exec()
  if (!profile) {
    throw new Error(`Feed's specified guild ${this.guild} was not found`)
  }
  const current = await this.model('Feed').findById(this._id).exec()
  // If current doesn't exist, then it's a new feed
  if (current && current.guild !== this.guild) {
    throw new Error('Guild cannot be changed')
  }
}

module.exports = {
  validate
}
