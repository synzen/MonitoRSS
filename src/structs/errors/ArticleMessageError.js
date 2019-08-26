class ArticleMessageError extends Error {
  constructor (guild, ...params) {
    super(...params)
    this.guild = guild

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ArticleMessageError)
    }
  }
}

module.exports = ArticleMessageError
