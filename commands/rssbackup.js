const currentGuilds = require('../util/storage.js').currentGuilds
const fs = require('fs')

function sendFile (guildRss, message) {
  const guildID = message.guild.id
  fs.writeFile(`./temp/${guildID}.json`, JSON.stringify(guildRss, null, 2), err => {
    if (err) {
      console.log('Commands Warning: Unable to write to file for rssbackup', err.message || err)
      return message.channel.send('Unable to send profile due to internal error.')
    }
    message.channel.send('', {file: `./temp/${guildID}.json`})
    .then(m => {
      fs.unlink(`./temp/${guildID}.json`, linkErr => {
        if (linkErr) console.log('Commands Warning: Unable readdir temp', linkErr.message || linkErr)
        fs.readdir('./temp', (err, files) => {
          if (err && !linkErr) return console.log('Commands Warning: Unable readdir temp', err.message || err)
          else if (err) return
          if (files.length === 0) {
            fs.rmdir('./temp', err => {
              if (err) return console.log('Commands Warning: Unable rmdir temp', err.message || err)
            })
          }
        })
      })
    }).catch(err => console.log(`Commands Warning: (${guildID}, ${guildID}) => Unable to send rssbackup attachment`, err.message || err))
  })
}

module.exports = (bot, message, automatic) => { // automatic indicates invokation by the bot
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss && !automatic) message.channel.send('This server does not have a profile.')
  if (!guildRss) return

  if (!fs.existsSync('./temp')) {
    fs.mkdir('./temp', err => {
      if (err) {
        console.log('Commands Warning: Unable to create temp dir for rssbackup', err.message || err)
        return message.channel.send('Unable to send profile due to internal error.')
      }
      sendFile(guildRss, message)
    })
  } else sendFile(guildRss, message)
}
