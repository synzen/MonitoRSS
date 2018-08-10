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
const CON_SETTINGS = typeof config.database.connection === 'object' ? config.database.connection : {}

const buffers = {}
if (Object.keys(CON_SETTINGS).length > 0) {
  for (var x = 0; x < BUFFER_CONFIGS.length; ++x) {
    const name = BUFFER_CONFIGS[x]
    if (CON_SETTINGS[name]) buffers[name] = fs.readFileSync(CON_SETTINGS[name])
  }
}

mongoose.connect(config.database.uri, { keepAlive: 120, useNewUrlParser: true, ...CON_SETTINGS, ...buffers })
const db = mongoose.connection

db.on('error', console.log)
db.once('open', () => {
  // Otherwise drop the "guilds" collection from database for do-over if WIPE_DATABASE is true
  storage.models.GuildRss().find((err, docs) => {
    if (err) throw err
    let c = 0
    docs.forEach(guildRss => {
      const rssList = guildRss.sources
      let changed = false
      for (var rssName in rssList) {
        const filters = rssList[rssName].filters
        if (!filters) continue
        for (var filterType in filters) {
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
          if (!invalidFilterTypes[filterType]) continue
          Object.defineProperty(filters, invalidFilterTypes[filterType], Object.getOwnPropertyDescriptor(filters, filterType))
          delete filters[filterType]
          changed = true
        }
      }
      if (changed) {
        storage.models.GuildRss().update({ id: guildRss.id }, guildRss, { overwrite: true, upsert: true, strict: true }, err => {
          if (err) throw err
          console.log(`Completed ${guildRss.id} (${++c}/${docs.length}) [UPDATED]`)
          if (c === docs.length) db.close()
        })
      } else {
        console.log(`Completed ${guildRss.id} (${++c}/${docs.length})`)
      }
    })
  })
})
