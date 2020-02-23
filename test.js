const config = require('./src/config.js')
const Feed = require('./src/structs/db/Feed.js')
const FeedData = require('./src/structs/db/FeedData.js')
const connect = require('./src/util/connectDatabase.js')

connect(true).then(async () => {
  const f = await FeedData.get('5e3de58ee2103e87148364f8')
  const all = await FeedData.getAll()
  for (const a of all) {
    a.toJSON()
  }
  throw 'ok'
  // try {
  //   const feeds = await Feed.getAll()
  //   console.log(feeds.length)
  //   const counter = new Map()
  //   for (const feed of feeds) {
  //     const got = counter.get(feed.guild)
  //     if (feed.disabled) {
  //       continue
  //     }
  //     if (!got) {
  //       counter.set(feed.guild, 1)
  //     } else {
  //       counter.set(feed.guild, got + 1)
  //     }
  //   }
  //   console.log('done')
  //   counter.forEach((count, guildId) => {
  //     if (count > config.feeds.max) {
  //       console.log(guildId)
  //     }
  //   })
  // } catch (err) {
  //   console.log(err)
  // }
})
