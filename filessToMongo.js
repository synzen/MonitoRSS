/*
  ONLY RUN THIS ONCE. If ran multiple times, set DROP_DATABASE to true, run again, and set to false for do-over
*/
const DROP_DATABASE = true

const fs = require('fs')
const config = require('./config.json')
const mongoose = require('mongoose')
const files = fs.readdirSync('./sources')
mongoose.connect(config.database.uri)//config.database.uri)
const db = mongoose.connection
let c = 0

const Guild = mongoose.model('Guild', mongoose.Schema({
  id: String,
  name: String,
  sources: Object,
  checkTitles: Boolean,
  imgPreviews: Boolean,
  imageLinksExistence: Boolean,
  checkDates: Boolean,
  dateFormat: String,
  dateLanguage: String,
  timezone: String
}))

function addFileToDb(name, i) {
  const id = name.replace(/\.json/i, '')
  if (!/^\d+$/.test(id)) return files.splice(i, 1)
  const guild = new Guild(JSON.parse(fs.readFileSync(`./sources/${id}.json`)))
  guild.save(err => {
    if (err) throw err
    console.log(`Completed ${name} (${++c}/${files.length})`)
    if (c === files.length) db.close()
  })
}

db.on('error', console.log)
db.once('open', () => {

  // Add to database
  if (!DROP_DATABASE) files.forEach(addFileToDb)

  // Drop database for do-over
  else Guild.collection.drop((err, res) => {
    if (err) throw err
    console.log(`Database drop successful`)
    db.close()
  })
})
