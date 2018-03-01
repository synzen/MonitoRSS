/*
  ONLY RUN THIS ONCE. If ran multiple times, set WIPE_DATABASE to true, run again to wipe the database, and set to false for do-over
*/
const WIPE_DATABASE = false

const fs = require('fs')
const config = require('./config.json')
const mongoose = require('mongoose')
const files = fs.readdirSync('./sources')
mongoose.connect(config.database.uri)
const db = mongoose.connection
let c = 0

const Guild = mongoose.model('Guild', mongoose.Schema({
  id: String,
  name: String,
  sources: Object,
  checkTitles: Boolean,
  imgPreviews: Boolean,
  imgLinksExistence: Boolean,
  checkDates: Boolean,
  dateFormat: String,
  dateLanguage: String,
  timezone: String
}))

function addFileToDb (name, i, arr) {
  const id = name.replace(/\.json/i, '')
  const guild = JSON.parse(fs.readFileSync(`./sources/${id}.json`))
  Guild.update({ id: id }, guild, { overwrite: true, upsert: true, strict: true }, err => {
    if (err) throw err
    console.log(`Completed ${name} (${++c}/${arr.length})`)
    if (c === arr.length) db.close()
  })
}

db.on('error', console.log)
db.once('open', () => {
  // Add to database if WIPE_DATABASE is false
  if (!WIPE_DATABASE) return files.filter((f, i) => /^\d+$/.test(f.replace(/\.json/i, ''))).forEach(addFileToDb)

  // Drop database for do-over if WIPE_DATABASE is true
  Guild.collection.drop((err, res) => {
    if (err) throw err
    console.log(`Database drop successful`)
    db.close()
  })

})
