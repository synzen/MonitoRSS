const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const fileOps = require('../util/fileOps.js')
const dbCmds = require('./db/commands.js')
const currentGuilds = require('../util/storage').currentGuilds
const ArticleModel = require('../util/storage.js').models.Article

exports.addToDb = function (articleList, rssName, callback, customTitle) {
  const total = articleList.length
  if (total === 0) return callback()

  function getArticleId (article) {
    let equalGuids = (articleList.length > 1) // default to true for most feeds
    if (equalGuids && articleList[0].guid) {
      articleList.forEach((article, index) => {
        if (index > 0 && article.guid !== articleList[index - 1].guid) equalGuids = false
      })
    }

    // If all articles have the same guids, fall back to title, and if no title, fall back to pubdate
    if ((!article.guid || equalGuids) && article.title) return article.title
    if ((!article.guid || equalGuids) && !article.title && article.pubdate && article.pubdate.toString() !== 'Invalid Date') return article.pubdate
    return article.guid
  }

  articleList.forEach(article => article._id = getArticleId(article))

  dbCmds.bulkInsert(ArticleModel(rssName), articleList, err => {
    if (err) return callback({type: 'database', content: err})
    callback()
  })
}

exports.addNewFeed = function (link, channel, cookies, callback, customTitle) {
  const feedparser = new FeedParser()
  const articleList = []
  let errored = false // Sometimes feedparser emits error twice

  requestStream(link, cookies, feedparser, function (err) {
    if (err && errored === false) {
      errored = true
      return callback({type: 'request', content: err})
    }
  })

  feedparser.on('error', function (err) {
    feedparser.removeAllListeners('end')
    if (err && errored === false) {
      errored = true
      return callback({type: 'feedparser', content: err})
    }
  })

  feedparser.on('readable', function () {
    let item
    while (item = this.read()) {
      articleList.push(item)
    }
  })

  feedparser.on('end', function () {
    if (errored) return

    const randomNum = Math.floor((Math.random() * 99999999999) + 1)
    let metaLink = ''
    if (articleList[0]) metaLink = (articleList[0].meta.link) ? articleList[0].meta.link : (articleList[0].meta.title) ? articleList[0].meta.title : `random_${Math.floor((Math.random() * 99999) + 1)}`
    else metaLink = `random_${Math.floor((Math.random() * 99999) + 1)}`

    let rssName = `${randomNum}_${metaLink}`.replace(/\./g, '')

    if (rssName.length >= 64) rssName = rssName.substr(0, 64)
    rssName = rssName.replace(/-|\?/g, '').replace(/\./g, '') // Remove question marks to prevent sql from auto-escaping, along with periods

    exports.addToDb(articleList, rssName, function (err) {
      if (err) return callback(err)
      addToConfig()
    })

    function addToConfig () {
      let metaTitle = customTitle || (articleList[0] && articleList[0].meta.title) ? articleList[0].meta.title : 'Untitled'

      if (articleList[0] && articleList[0].guid && articleList[0].guid.startsWith('yt:video')) metaTitle = `Youtube - ${articleList[0].meta.title}`
      else if (articleList[0] && articleList[0].meta.link && articleList[0].meta.link.includes('reddit')) metaTitle = `Reddit - ${articleList[0].meta.title}`

      if (metaTitle.length > 200) metaTitle = metaTitle.slice(0, 200) + ' [...]'

      var guildRss
      if (currentGuilds.has(channel.guild.id)) {
        guildRss = currentGuilds.get(channel.guild.id)
        if (!guildRss.sources) guildRss.sources = {}

        var rssList = guildRss.sources
        rssList[rssName] = {
          title: metaTitle,
          link: link,
          channel: channel.id
        }

        if (cookies) rssList[rssName].advanced = {cookies: cookies}
      } else {
        guildRss = {
          name: channel.guild.name,
          id: channel.guild.id,
          sources: {}
        }
        guildRss.sources[rssName] = {
          title: metaTitle,
          link: link,
          channel: channel.id
        }
        if (cookies) guildRss.sources[rssName].advanced = {cookies: cookies}

        currentGuilds.set(channel.guild.id, guildRss)
      }

      fileOps.updateFile(channel.guild.id, guildRss)
      callback(null, metaTitle, rssName)
    }
  })
}
