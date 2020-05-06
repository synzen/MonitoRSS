const Feed = require('./db/Feed.js')
const FeedData = require('./FeedData.js')

class NewArticle {
  /**
   * @param {Object<string, any>} article
   * @param {Object<string, any>} feedObject
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

  static async formatWithFeedData (newArticle) {
    const { article, feedObject } = newArticle
    const feed = new Feed(feedObject)
    const feedData = await FeedData.ofFeed(feed)
    return {
      ...article,
      _feed: feedData.toJSON()
    }
  }
}

module.exports = NewArticle
