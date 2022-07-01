const fs = require('fs')
const path = require('path')
const getConfig = require('../../src/config.js').get
const mongoose = require('mongoose')
const Profile = require('../../src/structs/db/Profile.js')
const Feed = require('../../src/structs/db/Feed.js')
const FilteredFormat = require('../../src/structs/db/FilteredFormat.js')
const Subscriber = require('../../src/structs/db/Subscriber.js')
const FailRecord = require('../../src/structs/db/FailRecord.js')
const Supporter = require('../../src/structs/db/Supporter.js')
const GuildData = require('../../src/structs/GuildData.js')
const oldEmbedKeys = {
  footer_text: 'footerText',
  footerIconUrl: 'footerIconURL',
  footer_icon_url: 'footerIconURL',
  author_name: 'authorName',
  authorIconUrl: 'authorIconURL',
  author_icon_url: 'authorIconURL',
  author_url: 'authorURL',
  authorUrl: 'authorURL',
  thumbnailUrl: 'thumbnailURL',
  thumbnail_url: 'thumbnailURL',
  imageUrl: 'imageURL',
  image_url: 'imageURL'
}

function HEXToVBColor (rrggbb) {
  const bbggrr = rrggbb.substr(4, 2) + rrggbb.substr(2, 2) + rrggbb.substr(0, 2)
  return parseInt(bbggrr, 16)
}

function sanitizeFilters (target) {
  const filters = target.filters
  if (filters) {
    for (const key in filters) {
      if (key.includes('.')) {
        delete filters[key]
      }
    }
  }
}

function getOldDate (hoursAgo) {
  // https://stackoverflow.com/questions/1050720/adding-hours-to-javascript-date-object
  const date = new Date()
  date.setTime(date.getTime() - hoursAgo * 60 * 60 * 1000)
  return date
}

async function updateVIP (vip) {
  const patreon = !vip.expireAt
  const toStore = {
    _id: vip.id
  }
  if (patreon && !vip.override) {
    toStore.patron = true
    toStore.guilds = vip.servers || []
  } else {
    toStore.webhook = vip.allowWebhooks
    toStore.guilds = vip.servers || []
    toStore.maxGuilds = vip.maxServers || 1
    toStore.maxFeeds = vip.maxFeeds
    if (vip.comment) {
      toStore.comment = vip.comment
    }
    if (vip.expireAt) {
      toStore.expireAt = vip.expireAt
    }
  }
  const supporter = new Supporter(toStore)
  await supporter.save()
}

async function updateFailRecords (doc) {
  const config = getConfig()
  const insert = {
    _id: doc.link
  }
  if (doc.failed) {
    insert.reason = doc.failed
    insert.alerted = true
    const record = new FailRecord(insert)
    const oldDate = getOldDate(config.feeds.hoursUntilFail + 10)
    record.failedAt = oldDate.toISOString()
    await record.save()
  } else {
    const record = new FailRecord(insert)
    await record.save()
  }
}

async function updateProfiles (guildRss) {
  const data = {
    feeds: [],
    filteredFormats: [],
    subscribers: []
  }
  // Profile first
  delete guildRss.version
  const profile = new Profile({
    ...guildRss,
    _id: guildRss.id,
    alert: guildRss.sendAlertsTo || []
  })
  const profileJSON = profile.toJSON()
  let populatedProfile = false
  for (const key in profileJSON) {
    if (key === '_id' || key === 'name') {
      continue
    }
    const value = profileJSON[key]
    if (key === 'alert') {
      if (value && value.length > 0) {
        populatedProfile = true
      }
      continue
    }
    if (key === 'prefix') {
      if (!value || value.includes(' ')) {
        // Delete prefixes with spaces - not supported
        profileJSON[key] = undefined
        continue
      }
    }
    if (value !== undefined) {
      populatedProfile = true
    }
  }
  if (populatedProfile) {
    data.profile = profileJSON
  }

  const rssList = guildRss.sources
  if (rssList) {
    for (const rssName in rssList) {
      // Feed
      const feed = { ...rssList[rssName] }
      feed.url = feed.link
      feed.guild = guildRss.id
      feed._id = new mongoose.Types.ObjectId().toHexString()
      // Since mongoose map keys cannot have dots, remove them
      sanitizeFilters(feed)

      // Format
      const text = feed.message
      if (text) {
        feed.text = text
      }
      const embeds = feed.embeds
      if (Array.isArray(embeds) && embeds.length > 0) {
        for (const embed of embeds) {
          // Replace old keys
          for (const key in oldEmbedKeys) {
            const newKey = oldEmbedKeys[key]
            const value = embed[key]
            if (value) {
              if (!embed[newKey]) {
                embed[newKey] = value
              }
              delete embed[key]
            }
          }

          // Convert hex strings to numbers
          if (embed.color && isNaN(Number(embed.color))) {
            embed.color = HEXToVBColor(embed.color)
          }

          const fields = embed.fields
          // Remove non-array fields
          if (!Array.isArray(fields)) {
            delete embed.fields
          } else {
            for (const field of fields) {
              field.name = field.title ? field.title : '\u200b'
              delete field.title
              field.value = field.value ? field.value : '\u200b'
            }
          }
        }
        FilteredFormat.pruneEmbeds(embeds)
      } else {
        delete feed.embeds
      }

      // Check titles
      if (feed.checkTitles) {
        feed.ncomparisons = ['title']
      }

      data.feeds.push(new Feed(feed).toJSON())

      // Subscribers
      const feedSubscribers = feed.subscribers
      if (feedSubscribers && feedSubscribers.length > 0) {
        for (const s of feedSubscribers) {
          sanitizeFilters(s)
          const subscriber = new Subscriber({
            ...s,
            type: s.type !== 'role' && s.type !== 'user' ? 'role' : s.type,
            feed: feed._id
          })
          data.subscribers.push(subscriber.toJSON())
        }
      }
    }
  }

  const guildData = new GuildData(data)
  await guildData.restore()
}

function formatRejections (results, dataList) {
  const errors = []
  for (let i = 0; i < results.length; ++i) {
    const result = results[i]
    if (result.status === 'rejected') {
      errors.push({
        error: result.reason.message,
        data: dataList[i]
      })
    }
  }
  return errors
}

/**
 * @param {boolean} databaseless
 * @param {string} uri
 * @param {import('mongoose').Connection} connection
 */
async function getProfiles (databaseless, uri, connection) {
  if (databaseless) {
    const names = fs.readdirSync(uri)
    return names.map(n => {
      const json = JSON.parse(fs.readFileSync(path.join(uri, n)))
      json._id = json.id
      return json
    })
  } else {
    return connection.collection('guilds').find({}).toArray()
  }
}

/**
 * @param {boolean} databaseless
 * @param {string} uri
 * @param {import('mongoose').Connection} connection
 */
async function startProfiles (databaseless, uri, connection) {
  console.log('Running profile migration')
  const guildRssList = await getProfiles(databaseless, uri, connection)
  if (guildRssList.length === 0) {
    console.log('No guilds found')
    return startFailRecords(databaseless, connection)
  }
  const promises = guildRssList.map(guildRss => updateProfiles(guildRss))
  const results = await Promise.allSettled(promises)
  const rejects = formatRejections(results, guildRssList)
  console.log(`Completed ${results.length} profiles`)
  return rejects.concat(await startFailRecords(databaseless, connection))
}

/**
 * @param {boolean} databaseless
 * @param {import('mongoose').Connection} connection
 */
async function startFailRecords (databaseless, connection) {
  if (databaseless) {
    console.log('Skipping fail records migration due to databaseless')
    return []
  }
  console.log('Running fail records migration')
  const failedLinks = await connection.collection('failed_links').find({}).toArray()
  if (failedLinks.length === 0) {
    console.log('No failed links found')
    return startVIPs(connection)
  }
  const promises = failedLinks.map(failedLink => updateFailRecords(failedLink))
  const results = await Promise.allSettled(promises)
  const rejects = formatRejections(results, failedLinks)
  console.log(`Completed ${results.length} fail records`)
  return rejects.concat(await startVIPs(connection))
}

/**
 *
 * @param {import('mongoose').Connection} connection
 */
async function startVIPs (connection) {
  const vips = await connection.collection('vips').find({}).toArray()
  if (vips.length === 0) {
    return []
  }
  const promises = vips.map(vip => updateVIP(vip))
  const results = await Promise.allSettled(promises)
  const rejects = formatRejections(results, vips)
  return rejects
}

exports.updateProfiles = updateProfiles
exports.updateFailRecords = updateFailRecords
exports.updateVIP = updateVIP
exports.run = startProfiles
