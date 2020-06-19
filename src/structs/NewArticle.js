class NewArticle {
  /**
   * @param {Object<string, any>} article
   * @param {Object<string, any>|import('./db/Feed.js')} feedObject
   */
  constructor (article, feedObject) {
    this.article = article
    this.feedObject = feedObject
  }

  toJSON () {
    return {
      article: this.article,
      feedObject: this.feedObject
    }
  }
}

module.exports = NewArticle
