const fs = require('fs')
const exec = require('child_process').exec
const log = require('../../util/logger.js')
const DATABASE_NAME = require('mongoose').connection.name

function backup (m, message, arg) {
  exec(`mongodump --db ${DATABASE_NAME} --collection ${arg} --archive=${arg}.archive --gzip`, (err, stdout, stderr) => {
    if (err) {
      log.controller.warning(`Database ${arg} backup failed:`, message.author, err)
      return m.edit(`Unable to backup, an error has occured. See console for details.`).catch(err => log.controller.warning(`Bot Controller: Unable to edit creating archive message to error for dbbackup:`, message.author, err))
    }
    attachFile(m, message, arg)
  })
}

function attachFile (m, message, arg) {
  m.delete()
  message.reply(`Successfully archived.`, { file: `./${arg}.archive` })
      .then(() => deleteTemp(m, message, arg))
      .catch(err => log.controller.warning(`Failed to send success message with archive attachment for dbbackup`, message.author, err))
}

function deleteTemp (m, message, arg) {
  fs.unlink(`./${arg}.archive`, err => {
    if (err) log.controller.warning(`Unable to delete temp file ./${arg}.archive after successfully backing up for dbbackup:`, message.author, err)
    else log.controller.info(`Archived backup successfully created and sent to Discord`, message.author)
  })
}

exports.normal = (bot, message) => {
  const arg = message.content.split(' ')[1] ? message.content.split(' ')[1] : 'guilds'
  console.log(`Bot Controller: Database ${arg} backup has been started by ${message.author.username}`)
  message.channel.send('Creating archive...').then(m => backup(m, message, arg)).catch(err => log.controller.warning(`Failed to send creating archive message for dbbackup:`, message.author, err))
}

exports.sharded = exports.normal
