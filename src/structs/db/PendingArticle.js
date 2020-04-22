const PendingArticleModel = require('../../models/PendingArticle.js')
const Base = require('./Base.js')

class PendingArticle extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * Article
     * @type {Object<string, any>}
     */
    this.article = this.getField('article')
    if (this.article === undefined) {
      throw new TypeError('article is undefined')
    }
  }

  toObject () {
    return {
      _id: this._id,
      article: this.article
    }
  }

  /**
   * Pending article's ID to delete
   * @param {string} id
   */
  static async deleteID (id) {
    if (!id) {
      return
    }
    const pending = await PendingArticle.get(id)
    if (pending) {
      await pending.delete()
    }
  }

  static get Model () {
    return PendingArticleModel.Model
  }
}

module.exports = PendingArticle
