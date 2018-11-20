const WIPE_DATABASE = true

const fs = require('fs')
const config = require('./config.js')
const storage = require('./util/storage.js')
const mongoose = require('mongoose')
const BUFFER_CONFIGS = ['sslCA', 'sslCRL', 'sslCert', 'sslKey']
const CON_SETTINGS = typeof config.database.connection === 'object' ? config.database.connection : {}

const buffers = {}
if (Object.keys(CON_SETTINGS).length > 0) {
  for (var x = 0; x < BUFFER_CONFIGS.length; ++x) {
    const name = BUFFER_CONFIGS[x]
    if (CON_SETTINGS[name]) buffers[name] = fs.readFileSync(CON_SETTINGS[name])
  }
}

const files = fs.readdirSync('./sources')
mongoose.connect(config.database.uri, { keepAlive: 120, ...CON_SETTINGS, ...buffers })
const db = mongoose.connection
let c = 0

function addFileToDb (name, i, arr) {
  const id = name.replace(/\.json/i, '')
  const guild = JSON.parse(fs.readFileSync(`./sources/${id}.json`))
  storage.models.GuildRss().update({ id: id }, guild, { overwrite: true, upsert: true, strict: true }, err => {
    if (err) throw err
    console.log(`Completed ${name} (${++c}/${arr.length})`)
    if (c === arr.length) db.close()
  })
}

db.on('error', console.log)
db.once('open', () => {
  // Add the "guilds" collection tto database if WIPE_DATABASE is false
  if (WIPE_DATABASE === false) return files.filter(f => /^\d+$/.test(f.replace(/\.json/i, ''))).forEach(addFileToDb)

  // Otherwise drop the "guilds" collection from database for do-over if WIPE_DATABASE is true
  storage.models.GuildRss().collection.drop((err, res) => {
    if (err) throw err
    console.log(`Database drop successful`)
    db.close()
  })
})
