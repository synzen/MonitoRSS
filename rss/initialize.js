const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const dbOps = require('../util/dbOps.js')
const config = require('../config.json')
const dbCmds = require('./db/commands.js')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const FeedModel = storage.models.Feed
const log = require('../util/logger.js')

function resolveLink (link, callback) {
  dbOps.linkTracker.get((err, linkList) => {
    if (err) {
      log.general.warning(`Unable to get linkList for link resolution for ${link}`, err)
      return callback(err)
    }
    let newLink

    if (link.startsWith('http:')) {
      const temp = link.replace('http:', 'https:')
      if (linkList.get(temp)) newLink = temp
    }

    if (link.endsWith('/')) {
      const temp = link.slice(0, -1)
      if (linkList.get(temp)) newLink = temp
    }

    if (newLink) log.general.info(`New link ${link} has been resolved to ${newLink}`)
    callback(null, newLink)
  })
}

exports.addToDb = (articleList, link, callback, customTitle) => {
  if (articleList.length === 0) return callback()

  function getArticleId (article) {
    let equalGuids = articleList.length > 1 // default to true for most feeds
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

  // Initialize the feed collection if necessary, but only if a database is used. This file has no access to the feed collections if config.database.uri is a databaseless folder path
  if (!config.database.uri.startsWith('mongo')) return callback()
  const Feed = FeedModel(link, storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : null)
  dbCmds.findAll(Feed, (err, docs) => {
    if (err) {
      log.general.warning(`Unable to findAll to initialize ${link}`, err)
      return callback()
    }
    if (docs.length > 0) return callback() // The collection already exists from a previous addition, no need to initialize
    articleList.forEach(article => {
      article._id = getArticleId(article)
    })
    dbCmds.bulkInsert(Feed, articleList, err => {
      if (err) {
        log.general.warning(`Unable to bulk insert to initialize ${link}`, err)
        return callback()
      }
      callback()
    })
  })
}

exports.addNewFeed = (settings, callback, customTitle) => {
  let link = settings.link
  const { channel, cookies } = settings
  const feedparser = new FeedParser()
  const articleList = []
  let errored = false // Sometimes feedparser emits error twice

  resolveLink(link, (err, resolved) => {
    if (err) log.general.warning(`Unable to get linkList for link resolution for ${link}`, err)
    link = resolved || link
    const currentGuildRss = currentGuilds.get(channel.guild.id)
    if (currentGuildRss) {
      const currentRSSList = currentGuildRss.sources
      if (currentRSSList) {
        for (var n in currentRSSList) {
          const source = currentRSSList[n]
          if (source.link === link && source.channel === channel.id) {
            const err = new Error('Already exists for this channel.')
            err.type = 'resolved'
            return callback(err, link)
          }
        }
      }
    }

    requestStream(link, cookies, feedparser, err => {
      if (err && errored === false) {
        errored = true
        err.type = 'request'
        return callback(err)
      }
    })
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
    do {
      item = this.read()
      if (item) articleList.push(item)
    } while (item)
  })

  feedparser.on('end', () => {
    if (errored) return

    exports.addToDb(articleList, link, addToConfig)

    function addToConfig () {
      const rssName = `${storage.collectionId(link, storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : null)}>${Math.floor((Math.random() * 99999) + 1)}`
      let metaTitle = customTitle || (articleList[0] && articleList[0].meta.title) ? articleList[0].meta.title : 'Untitled'

      if (articleList[0] && articleList[0].guid && articleList[0].guid.startsWith('yt:video')) metaTitle = `Youtube - ${articleList[0].meta.title}`
      else if (articleList[0] && articleList[0].meta.link && articleList[0].meta.link.includes('reddit')) metaTitle = `Reddit - ${articleList[0].meta.title}`

      if (metaTitle.length > 200) metaTitle = metaTitle.slice(0, 200) + '...'

      let guildRss
      if (currentGuilds.has(channel.guild.id)) {
        guildRss = currentGuilds.get(channel.guild.id)
        if (!guildRss.sources) guildRss.sources = {}

        var rssList = guildRss.sources
        rssList[rssName] = {
          title: metaTitle,
          link: link,
          channel: channel.id,
          addedOn: new Date()
        }

        if (cookies) rssList[rssName].advanced = { cookies: cookies }
      } else {
        guildRss = {
          name: channel.guild.name,
          id: channel.guild.id,
          sources: {}
        }
        guildRss.sources[rssName] = {
          title: metaTitle,
          link: link,
          channel: channel.id,
          addedOn: new Date()
        }
        if (cookies) guildRss.sources[rssName].advanced = { cookies: cookies }

        currentGuilds.set(channel.guild.id, guildRss)
      }

      if (storage.vipServers[channel.guild.id] && storage.vipServers[channel.guild.id].benefactor.pledgedAmount < 500 && !link.includes('feed43.com')) {
        const feedSchedules = storage.scheduleManager.scheduleList
        let hasVipSchedule = false
        for (var x = 0; x < feedSchedules.length; ++x) {
          const schedule = feedSchedules[x].schedule
          if (schedule.name !== 'vip') continue
          hasVipSchedule = true
          schedule.keywords.push(link)
          storage.allScheduleWords.push(link)
          delete storage.scheduleAssigned[rssName]
        }
        if (!hasVipSchedule) {
          const newSched = { name: 'vip', refreshTimeMinutes: config._vipRefreshTimeMinutes ? config._vipRefreshTimeMinutes : 10, keywords: [link] }
          storage.scheduleManager.addSchedule(newSched)
          delete storage.scheduleAssigned[rssName]
        }
      }

      dbOps.guildRss.update(guildRss)
      dbOps.linkTracker.increment(link, err => {
        if (err) log.general.warning(`Unable to increment linkTracker for ${link} after feed addition`, err)
      })
      callback(null, link, metaTitle, rssName)
    }
  })
}
