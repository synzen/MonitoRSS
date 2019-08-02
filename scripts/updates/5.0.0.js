
// Use this to convert the deprecated old filter references to new ones on any versions past 3.0.0, including dev branch

// const fs = require('fs')
// const config = require('../config.js')
// const storage = require('../util/storage.js')
// const mongoose = require('mongoose')
// const BUFFER_CONFIGS = ['sslCA', 'sslCRL', 'sslCert', 'sslKey']

// if (config.database.uri.startsWith('mongo')) {
//   const CON_SETTINGS = typeof config.database.connection === 'object' ? config.database.connection : {}

//   const buffers = {}
//   if (Object.keys(CON_SETTINGS).length > 0) {
//     for (let x = 0; x < BUFFER_CONFIGS.length; ++x) {
//       const name = BUFFER_CONFIGS[x]
//       if (CON_SETTINGS[name]) buffers[name] = fs.readFileSync(CON_SETTINGS[name])
//     }
//   }

//   const uri = config.database.uri

//   console.log(`Connecting to MongoDB database URI ${uri}`)
//   mongoose.connect(uri, { keepAlive: 120, useNewUrlParser: true, ...CON_SETTINGS, ...buffers })
//   mongoose.set('useCreateIndex', true)
//   const db = mongoose.connection

//   db.on('error', console.log)
//   db.once('open', () => {
//     // Otherwise drop the "guilds" collection from database for do-over if WIPE_DATABASE is true
//     storage.models.GuildRss().find({}).lean().exec((err, docs) => {
//       if (err) throw err
//       let c = 0
//       docs.forEach(guildRss => {
//         let changed = updateGuildRss(guildRss)
//         if (changed) {
//           storage.models.GuildRss().replaceOne({ _id: guildRss._id }, guildRss, { overwrite: true, upsert: true, strict: true }, (err, res) => {
//             if (err) throw err
//             console.log(`Completed ${guildRss.id} (${++c}/${docs.length}) [UPDATED]`)
//             if (c === docs.length) db.close()
//           })
//         } else {
//           console.log(`Completed ${guildRss.id} (${++c}/${docs.length}) [No Change]`)
//           if (c === docs.length) db.close()
//         }
//       })
//     })
//   })
// } else {
//   const folderPath = config.database.uri
//   fs.readdir(folderPath, (err, files) => {
//     if (err) throw err
//     if (!fs.existsSync(`${folderPath}/backup`)) fs.mkdirSync(`${folderPath}/backup`)
//     let c = 0
//     const fileNames = files.filter(f => /^\d+$/.test(f.replace(/\.json/i, '')))
//     for (const fileName of fileNames) {
//       // Read the file first
//       fs.readFile(`${folderPath}/${fileName}`, { encoding: 'utf8' }, (err, data) => {
//         if (err) throw err
//         const guildRss = JSON.parse(data)
//         // Write it to backup
//         fs.writeFile(`${folderPath}/backup/${fileName}`, JSON.stringify(guildRss, null, 2), err => {
//           if (err) throw err
//           // Now overwrite the old with the new if necessary
//           const changed = updateGuildRss(guildRss)
//           if (!changed) console.log(`Completed ${guildRss.id} (${++c}/${fileNames.length}) [No Change]`)
//           else {
//             fs.writeFile(`${folderPath}/${fileName}`, JSON.stringify(guildRss, null, 2), err => {
//               if (err) throw err
//               console.log(`Completed ${guildRss.id} (${++c}/${fileNames.length}) [UPDATED]`)
//             })
//           }
//         })
//       })
//     }
//   })
// }

function updateGuildRss (guildRss) {
  const rssList = guildRss.sources
  let changed = false

  if (guildRss.sendAlertsTo && guildRss.sendAlertsTo.length === 0) {
    delete guildRss.sendAlertsTo
    changed = true
  }

  for (const rssName in rssList) {
    const source = rssList[rssName]

    if (source.filteredSubscriptions) {
      const filteredSubscriptions = source.filteredSubscriptions
      const subscriberCount = {}
      for (const subscriber of filteredSubscriptions) {
        if (!subscriberCount[subscriber.id]) subscriberCount[subscriber.id] = { count: 1, ...subscriber }
        else {
          subscriberCount[subscriber.id].count++
          const previousRecordedFilters = subscriberCount[subscriber.id].filters
          const subscriberFilters = subscriber.filters
          for (const filterType in subscriberFilters) {
            if (!previousRecordedFilters[filterType]) previousRecordedFilters[filterType] = subscriberFilters[filterType]
            else {
              const filtersToConcat = subscriberFilters[filterType]
              for (const word of filtersToConcat) {
                if (!previousRecordedFilters[filterType].includes(word)) previousRecordedFilters[filterType].push(word)
              }
            }
          }
        }
      }

      for (const recordedSubscriberId in subscriberCount) {
        const recordedSubscriber = subscriberCount[recordedSubscriberId]
        if (recordedSubscriber.count > 1) {
          changed = true
          for (let i = filteredSubscriptions.length - 1; i >= 0; --i) {
            const subscriber = filteredSubscriptions[i]
            if (subscriber.id === recordedSubscriberId) {
              source.filteredSubscriptions.splice(i, 1)
            }
          }
          delete recordedSubscriber.count
          source.filteredSubscriptions.push(recordedSubscriber)
        }
      }
    }

    const subscribers = []
    if (source.filteredSubscriptions && source.filteredSubscriptions.length > 0) {
      for (const subscriber of source.filteredSubscriptions) {
        subscribers.push(subscriber)
      }
      changed = true
    }
    if (source.globalSubscriptions && source.globalSubscriptions.length > 0) {
      for (const subscriber of source.globalSubscriptions) {
        subscribers.push(subscriber)
      }
      changed = true
    }
    delete source.filteredSubscriptions
    delete source.globalSubscriptions

    if (subscribers.length > 0) source.subscribers = subscribers

    if (source.dateSettings) {
      changed = true
      delete source.dateSettings
    }
    if (source.guildId) {
      changed = true
      delete source.guildId
    }

    if (source.channelName) {
      changed = true
      delete source.channelName
    }
  }

  if (!guildRss.version || guildRss.version !== '5.0.0') {
    guildRss.version = '5.0.0'
    changed = true
  }

  return changed
}

exports.updateGuildRss = updateGuildRss
