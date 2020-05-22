const ArticleMessage = require('./ArticleMessage.js')

class ArticleTestMessage extends ArticleMessage {
  passedFilters () {
    return true
  }
}

module.exports = ArticleTestMessage
