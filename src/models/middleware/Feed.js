/**
 * @this import('mongoose').DocumentQuery
 */
async function findOneAndUpdate () {
  const current = this.model.findOne(this.getQuery())
  if (current.guild !== this.guild) {
    throw new Error('Guild cannot be changed')
  }
}

/**
 * @this import('mongoose').MongooseDocument
 */
async function save () {
  const profile = await this.model('Guild').findById(this.guild).exec()
  if (!profile) {
    throw new Error(`Feed's specified guild ${this.guild} was not found`)
  }
}

module.exports = {
  findOneAndUpdate,
  save
}
