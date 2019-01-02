// Use this to convert the deprecated old filter references to new ones on any versions past 3.0.0, including dev branch

const fs = require('fs')
const config = require('./config.js')
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
const invalidSubscriptionProperties = {
  roleName: 'name',
  roleID: 'id'
}
if (config.database.uri.startsWith('mongo')) {
  const CON_SETTINGS = typeof config.database.connection === 'object' ? config.database.connection : {}

  const buffers = {}
  if (Object.keys(CON_SETTINGS).length > 0) {
    for (let x = 0; x < BUFFER_CONFIGS.length; ++x) {
      const name = BUFFER_CONFIGS[x]
      if (CON_SETTINGS[name]) buffers[name] = fs.readFileSync(CON_SETTINGS[name])
    }
  }

  const uri = config.database.uri

  mongoose.connect(uri, { keepAlive: 120, useNewUrlParser: true, ...CON_SETTINGS, ...buffers })
  mongoose.set('useCreateIndex', true)
  const db = mongoose.connection

  db.on('error', console.log)
  db.once('open', () => {
    // Otherwise drop the "guilds" collection from database for do-over if WIPE_DATABASE is true
    let c = 0
    storage.models.GuildRss().find({}).lean().exec((err, docs) => {
      if (err) throw err
      docs.forEach(guildRss => {
        let changed = updateGuildRss(guildRss)
        if (changed) {
          storage.models.GuildRss().replaceOne({ _id: guildRss._id }, guildRss, { overwrite: true, upsert: true, strict: true }, (err, res) => {
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
} else {
  const folderPath = config.database.uri
  fs.readdir(folderPath, (err, files) => {
    if (err) throw err
    if (!fs.existsSync(`${folderPath}/backup`)) fs.mkdirSync(`${folderPath}/backup`)
    let c = 0
    const fileNames = files.filter(f => /^\d+$/.test(f.replace(/\.json/i, '')))
    for (const fileName of fileNames) {
      // Read the file first
      fs.readFile(`${folderPath}/${fileName}`, { encoding: 'utf8' }, (err, data) => {
        if (err) throw err
        const guildRss = JSON.parse(data)
        // Write it to backup
        fs.writeFile(`${folderPath}/backup/${fileName}`, JSON.stringify(guildRss, null, 2), err => {
          if (err) throw err
          // Now overwrite the old with the new if necessary
          const changed = updateGuildRss(guildRss)
          if (!changed) console.log(`Completed ${guildRss.id} (${++c}/${fileNames.length})`)
          else {
            fs.writeFile(`${folderPath}/${fileName}`, JSON.stringify(guildRss, null, 2), err => {
              if (err) throw err
              console.log(`Completed ${guildRss.id} (${++c}/${fileNames.length}) [UPDATED]`)
            })
          }
        })
      })
    }
  })
}

function updateGuildRss (guildRss) {
  const rssList = guildRss.sources
  let changed = false
  for (const rssName in rssList) {
    const source = rssList[rssName]
    // Embed
    const embedMessage = rssList[rssName].embedMessage
    if (embedMessage) {
      // Rename the individual properties first
      if (embedMessage.properties && Object.keys(embedMessage.properties).length > 0) {
        for (const ep in embedMessage.properties) {
          if (invalidEmbedProperties[ep]) continue
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
      for (let fi = 0; fi < filteredFormats.length; ++fi) {
        const filteredFormat = filteredFormats[fi]
        const filteredFormatFilters = filteredFormat.filters
        for (const fff in filteredFormatFilters) {
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
              for (const ffep in embedMessage.properties) {
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
    if (filters) {
      for (const filterType in filters) {
        // Role subscriptions
        if (filterType === 'roleSubscriptions' || filterType === 'userSubscriptions') {
          const filterContent = filters[filterType]
          for (const roleId in filterContent) {
            const roleFilters = filterContent[roleId].filters
            for (const roleFilterType in roleFilters) {
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

    // Just initialize these first, and check if they're empty at the end
    if (!source.globalSubscriptions) source.globalSubscriptions = []
    if (!source.filteredSubscriptions) source.filteredSubscriptions = []

    // Deprecated Subscriptions
    const deprecatedGlobalSubscriptionNames = ['roleSubscriptions', 'userSubscriptions']
    for (let i = 0; i < deprecatedGlobalSubscriptionNames.length; ++i) {
      const subscriberType = i === 0 ? 'role' : 'user'
      const typeName = deprecatedGlobalSubscriptionNames[i]

      const globalReference = source[typeName]
      const filteredReference = source.filters ? source.filters[typeName] : undefined
      // Do for both global and filtered
      if (globalReference) {
        for (let i = globalReference.length - 1; i >= 0; --i) {
          const subscriber = globalReference[i]
          for (const key in subscriber) {
            if (!invalidSubscriptionProperties[key]) continue
            Object.defineProperty(subscriber, invalidSubscriptionProperties[key], Object.getOwnPropertyDescriptor(subscriber, key))
            delete subscriber[key]
          }
          changed = true
          source.globalSubscriptions.push({ type: subscriberType, id: subscriber.id, name: subscriber.name })
          globalReference.splice(i, 1)
        }
      }

      if (filteredReference) {
        for (const id in filteredReference) {
          const subscriber = filteredReference[id]
          for (const key in subscriber) {
            if (!invalidSubscriptionProperties[key]) continue
            Object.defineProperty(subscriber, invalidSubscriptionProperties[key], Object.getOwnPropertyDescriptor(subscriber, key))
            delete subscriber[key]
          }
          changed = true
          source.filteredSubscriptions.push({ type: subscriberType, id: id, name: subscriber.name, filters: subscriber.filters })
          delete filteredReference[id]
        }
      }
    }

    if (source.globalSubscriptions.length === 0) delete source.globalSubscriptions
    if (source.filteredSubscriptions.length === 0) delete source.filteredSubscriptions
    if (source.filters && source.filters.roleSubscriptions && Object.keys(source.filters.roleSubscriptions).length === 0) delete source.filters.roleSubscriptions
    if (source.roleSubscriptions && source.roleSubscriptions.length === 0) delete source.roleSubscriptions
  }

  return changed
}
