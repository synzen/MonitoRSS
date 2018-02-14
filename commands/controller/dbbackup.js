const fs = require('fs')
const exec = require('child_process').exec
const config = require('../../config.json')
const DATABASE_NAME = require('mongoose').connection.name

exports.normal = (bot, message) => {
    console.log(`Bot Controller: Database guilds backup has been started by ${message.author.username}`)
    message.channel.send('Creating archive...')
    .then(backup).catch(err => console.log(`Bot Controller: Failed to send creating archive message for dbbackup:`, err.message || err))

    function backup(m) {
        exec(`mongodump --db ${DATABASE_NAME} --collection guilds --archive=guilds.archive --gzip`, (err, stdout, stderr) => {
            if (err) {
                console.info(`Bot Controller: Database guilds backup failed:`, err)
                return m.edit(`Unable to backup, an error has occured. See console for details.`).catch(err => console.log(`Bot Controller: Unable to edit creating archive message to error for dbbackup:`, err.message || err))
            }
            attachFile(m)
        })
    }

    function attachFile(m) {
        m.delete()
        message.reply(`Successfully archived.`, {file: './guilds.archive'})
        .then(deleteTemp)
        .catch(err => console.log(`Bot Controller: Failed to send success message with archive attachment for dbbackup`, err.message || err))
    }

    function deleteTemp(m) {
        fs.unlink('./guilds.archive', err => {
            if (err) console.log('Bot Controller: Unable to delete temp file ./guilds.archive after successfully backing up for dbbackup:', err.message || err)
            else console.log(`Bot Controller: Archived backup successfully created and sent to Discord.`)
        })
    }
}

exports.sharded = exports.normal
