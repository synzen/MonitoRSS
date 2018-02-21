const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const fileOps = require('../util/fileOps.js')
const dbCmds = require('./db/commands.js')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const linkList = storage.linkList
const ArticleModel = require('../util/storage.js').models.Article

exports.addToDb = (articleList, rssName, callback, customTitle) => {
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

  articleList.forEach(article => {
    article._id = getArticleId(article)
  })

  dbCmds.bulkInsert(ArticleModel(rssName), articleList, err => {
    if (err) {
      err.type = 'database'
      return callback(err)
    }
    callback()
  })
}

exports.addNewFeed = (settings, callback, customTitle) => {
  let link = settings.link
  const { channel, cookies } = settings
  const feedparser = new FeedParser()
  const articleList = []
  let errored = false // Sometimes feedparser emits error twice

  requestStream(link, cookies, feedparser, err => {
    if (err && errored === false) {
      errored = true
      err.type = 'request'
      return callback(err)
    }
  })

  feedparser.on('error', err => {
    feedparser.removeAllListeners('end')
    if (err && errored === false) {
      errored = true
      err.type = 'feedparser'
      return callback(err)
    }
  })

  feedparser.on('readable', function () {
    let item
    while (item = this.read()) {
      articleList.push(item)
    }
  })

  feedparser.on('end', () => {
    if (errored) return

    const randomNum = Math.floor((Math.random() * 99999999999) + 1)
    let metaLink = ''
    if (articleList[0]) metaLink = (articleList[0].meta.link) ? articleList[0].meta.link : (articleList[0].meta.title) ? articleList[0].meta.title : `random_${Math.floor((Math.random() * 99999) + 1)}`
    else metaLink = `random_${Math.floor((Math.random() * 99999) + 1)}`

    let rssName = `${randomNum}_${metaLink}`.replace(/\./g, '')

    if (rssName.length >= 64) rssName = rssName.substr(0, 64)
    rssName = rssName.replace(/\$|\./g, '') // Remove MongoDB illegal characters

    exports.addToDb(articleList, rssName, err => {
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
      linkList.push(link)
      callback(null, link, metaTitle, rssName)
    }
  })
}

// String approximation for later implementation
//
// const needle = require('needle')
// const Fuse = require('fuse.js')
// const REQ_OPTIONS = {
//   timeout: 27000,
//   read_timeout: 24000,
//   follow_max: 5,
//   follow_set_cookies: true,
//   rejectUnauthorized: true,
//   headers: {'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36'},
//   decode: false
// }
// const FUSE_OPTIONS = {
//   keys: ['link'],
//   threshold: 0.025,
//   includeScore: true
// }

// function compareLink (origBody, testLink) {
//   return new Promise((resolve, reject) => {
//     needle.get(testLink, REQ_OPTIONS, (err, res) => {
//       if (err) return reject(err)
//       if (JSON.stringify(res.body) === origBody) return resolve(testLink)
//       reject(new Error('Unequal URLs'))
//     })
//   })
// }

// function approximate (link) { // Approximate link to a an identical one if it exists
//   return new Promise(function (resolve, reject) {
//     const objectLinkList = []
//     const noDupLinkList = []
//     linkList.forEach(item => {
//       if (!noDupLinkList.includes(item)) noDupLinkList.push(item)
//     })
//     noDupLinkList.forEach(item => objectLinkList.push({link: item}))
//     let test = []
//     let approximated

//     const fuse = new Fuse(objectLinkList, FUSE_OPTIONS)
//     const results = fuse.search(link)
//     console.info(results)
//     console.log(0)

//     for (var x = 0; i < results.length; ++i) {

//       const res = results[i]
//       if (res.score === 0) {
//         console.log('resolved')
//         return resolve(res.item.link)
//       }
//       test.push(res.item.item)
//     }

//     needle.get(testLink, REQ_OPTIONS, (err, res) => {
//       if (err) {
//         console.log(err)
//         return reject(err)
//       }
//       const origBody = JSON.stringify(res.body)
//       let c = 0
//       consoel.log('here')
//       if (test.length === 0) return reverse()
//       for (var u = 0; u < test.length; ++u) {
//         compareLink(origBody, test[u])
//         .then(approx => resolve(approx))
//         .catch(e => {
//           if (++c === test.length) reverse(origBody)
//         })
//       }
//     })

//     function reverse (origBody) {
//       console.log('reverse')
//       test.length = 0
//       const fuseReverse = new Fuse([{link: link}], FUSE_OPTIONS)
//       for (var r = 0; r < noDupLinkList.length; ++r) {
//         const curLink = noDupLinkList[r]
//         const resultsReverse = fuseReverse.search(curLink)
//         if (resultsReverse.length === 0) return reject(new Error(`No approximations`))
//         if (res.score === 0) return resolve(curLink)
//         test.push(curLink)
//       }
//       if (test.length === 0) return reject(new Error(`No approximations`))
//       let c = 0
//       for (var h = 0; h < test.length; ++h) {
//         compareLink(origBody, test[h])
//         .then(approx => resolve(approx))
//         .catch(e => {
//           if (++c === test.length) reject(new Error(`No approximations`))
//         })
//       }
//     }
//   })
// }
