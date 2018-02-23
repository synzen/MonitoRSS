const currentGuilds = require('../util/storage.js').currentGuilds
const fs = require('fs')
const log = require('../util/logger.js')

function sendFile (guildRss, message) {
  const guildID = message.guild.id
  fs.writeFile(`./temp/${guildID}.json`, JSON.stringify(guildRss, null, 2), err => {
    if (err) {
      log.command.warning('Unable to write to file for rssbackup', message.channel, err)
      return message.channel.send('Unable to send profile due to internal error.')
    }
    message.channel.send('', {file: `./temp/${guildID}.json`})
    .then(m => {
      fs.unlink(`./temp/${guildID}.json`, linkErr => {
        if (linkErr) log.general.warning('Unable readdir temp after rssbackup', err)
        fs.readdir('./temp', (err, files) => {
          if (err && !linkErr) return log.general.warning('Unable readdir temp after rssbackup', err)
          else if (err) return
          if (files.length === 0) {
            fs.rmdir('./temp', err => {
              if (err) return log.general.warning('Unable rmdir temp after rssbackup', err)
            })
          }
        })
      })
    }).catch(err => log.command.warning(`Unable to send rssbackup attachment`, message.guild, err))
  })
}

module.exports = (bot, message, automatic) => { // automatic indicates invokation by the bot
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss && !automatic) message.channel.send('This server does not have a profile.')
  if (!guildRss) return

  if (!fs.existsSync('./temp')) {
    fs.mkdir('./temp', err => {
      if (err) {
        log.command.warning('Unable to create temp dir for rssbackup', message.guild, err)
        return message.channel.send('Unable to send profile due to internal error.')
      }
      sendFile(guildRss, message)
    })
  } else sendFile(guildRss, message)
}
