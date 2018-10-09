// Use this to convert the deprecated old filter references to new ones on any versions past 3.0.0, including dev branch

const fs = require('fs')
const config = require('./config.json')
const storage = require('./util/storage.js')
const mongoose = require('mongoose')
const BUFFER_CONFIGS = ['sslCA', 'sslCRL', 'sslCert', 'sslKey']
const invalidFilterTypes = {
  Title: 'title',
  Description: 'description',
  Tag: 'tag',
  Author: 'author',
  Summary: 'summary'
}
const invalidEmbedProperties = {
  footerIconURL: 'footer_icon_url',
  footerText: 'footer_text',
  thumbnailURL: 'thumbnail_url',
  imageURL: 'image_url',
  authorTitle: 'author_name',
  authorURL: 'author_url',
  authorAvatarURL: 'author_icon_url',
  message: 'description'
}
const CON_SETTINGS = typeof config.database.connection === 'object' ? config.database.connection : {}

const buffers = {}
if (Object.keys(CON_SETTINGS).length > 0) {
  for (var x = 0; x < BUFFER_CONFIGS.length; ++x) {
    const name = BUFFER_CONFIGS[x]
    if (CON_SETTINGS[name]) buffers[name] = fs.readFileSync(CON_SETTINGS[name])
  }
}

const uri = process.env.DRSS_DATABASE_URI || config.database.uri

mongoose.connect(uri, { keepAlive: 120, useNewUrlParser: true, ...CON_SETTINGS, ...buffers })
const db = mongoose.connection

db.on('error', console.log)
db.once('open', () => {
  // Otherwise drop the "guilds" collection from database for do-over if WIPE_DATABASE is true
  storage.models.GuildRss().find({}).lean().exec((err, docs) => {
    if (err) throw err
    let c = 0
    docs.forEach(guildRss => {
      const rssList = guildRss.sources
      let changed = false
      for (var rssName in rssList) {
        // Embed
        const embedMessage = rssList[rssName].embedMessage
        if (embedMessage) {
          // Rename the individual properties first
          if (embedMessage.properties && Object.keys(embedMessage.properties).length > 0) {
            for (var ep in embedMessage.properties) {
              if (!invalidEmbedProperties[ep]) continue
              Object.defineProperty(embedMessage.properties, invalidEmbedProperties[ep], Object.getOwnPropertyDescriptor(embedMessage.properties, ep))
              delete embedMessage.properties[ep]
              changed = true
            }
          } else delete rssList[rssName].embedMessage
          // Then rename the embedMessage
          if (rssList[rssName].embedMessage) {
            rssList[rssName].embeds = [rssList[rssName].embedMessage.properties]
            delete rssList[rssName].embedMessage
            changed = true
          }
        }

        // Filtered message formats
        const filteredFormats = rssList[rssName].filteredFormats
        if (filteredFormats) {
          for (var fi = 0; fi < filteredFormats.length; ++fi) {
            const filteredFormat = filteredFormats[fi]
            const filteredFormatFilters = filteredFormat.filters
            for (var fff in filteredFormatFilters) {
              // Filtered format filters
              if (!invalidFilterTypes[fff]) continue
              Object.defineProperty(filteredFormatFilters, invalidFilterTypes[fff], Object.getOwnPropertyDescriptor(filteredFormatFilters, fff))
              delete filteredFormatFilters[fff]
              changed = true
              // Filtered format embed
              const embedMessage = filteredFormat.embedMessage
              if (embedMessage) {
                // Rename the individual properties first
                if (embedMessage.properties && Object.keys(embedMessage.properties).length > 0) {
                  for (var ffep in embedMessage.properties) {
                    if (!invalidEmbedProperties[ffep]) continue
                    Object.defineProperty(embedMessage.properties, invalidEmbedProperties[ffep], Object.getOwnPropertyDescriptor(embedMessage.properties, ffep))
                    delete embedMessage.properties[ffep]
                    changed = true
                  }
                } else delete filteredFormat.embedMessage
                // Then rename the embedMessage
                if (filteredFormat.embedMessage) {
                  filteredFormat.embeds = [filteredFormat.embedMessage.properties]
                  delete filteredFormat.embedMessage
                  changed = true
                }
              }
            }
          }
        }

        // Filters
        const filters = rssList[rssName].filters
        if (!filters) continue
        for (var filterType in filters) {
          // Role subscriptions
          if (filterType === 'roleSubscriptions') {
            const filterContent = filters[filterType]
            for (var roleId in filterContent) {
              const roleFilters = filterContent[roleId].filters
              for (var roleFilterType in roleFilters) {
                if (!invalidFilterTypes[roleFilterType]) continue
                Object.defineProperty(roleFilters, invalidFilterTypes[roleFilterType], Object.getOwnPropertyDescriptor(roleFilters, roleFilterType))
                delete roleFilters[roleFilterType]
                changed = true
              }
            }
          }

          // Regular filters
          if (!invalidFilterTypes[filterType]) continue
          Object.defineProperty(filters, invalidFilterTypes[filterType], Object.getOwnPropertyDescriptor(filters, filterType))
          delete filters[filterType]
          changed = true
        }
      }

      if (changed) {
        storage.models.GuildRss().update({ _id: guildRss._id }, guildRss, { overwrite: true, upsert: true, strict: true }, (err, res) => {
          if (err) throw err
          console.log(`Completed ${guildRss.id} (${++c}/${docs.length}) [UPDATED]`)
          if (c === docs.length) db.close()
        })
      } else {
        console.log(`Completed ${guildRss.id} (${++c}/${docs.length})`)
        if (c === docs.length) db.close()
      }
    })
  })
})
