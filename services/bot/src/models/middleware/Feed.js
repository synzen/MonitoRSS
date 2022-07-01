/**
 * @param {import('mongoose').Connection} connection
 */
function validate (connection) {
  /**
   * @this import('mongoose').MongooseDocument
   */
  async function run () {
    const current = await connection.model('feed').findById(this._id).exec()
    // If current doesn't exist, then it's a new feed
    if (current && current.guild !== this.guild) {
      throw new Error('Guild cannot be changed')
    }
  }
  return run
}

module.exports = {
  validate
}
