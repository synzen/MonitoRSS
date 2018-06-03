const fs = require('fs')
const needle = require('needle')
const mongoose = require('mongoose')
const exec = require('child_process').exec
const DATABASE_NAME = require('mongoose').connection.name
const scheduleManager = require('../../util/storage.js').scheduleManager
const log = require('../../util/logger.js')

function restore (fileName, databaseName, callback) {
  exec(`mongorestore --gzip --archive=${fileName} --nsInclude ${databaseName}.guilds`, callback)
}

exports.normal = async (bot, message) => {
  try {
    if (scheduleManager.cyclesInProgress()) return await message.channel.send(`Unable to start restore while a retrieval cycle is in progress. Try again later.`)
    const archive = message.attachments.first()
    if (!archive) return await message.channel.send('No archive found as an attachment.')

    const fileName = archive.filename
    if (!fileName.endsWith('.archive')) return message.channel.send('That is not a valid archive to restore.').catch(err => console.log(`Bot Controller: Unable to send invalid archive message for dbrestore:`, err.message || err))
    console.log(`Bot Controller: Database restore has been started by ${message.author.username}`)
    const m = await message.channel.send('Restoring...')
    scheduleManager.stopSchedules()
    exports.restoreUtil(m, fileName, archive.url)
      .then(() => process.exit())
      .catch(err => {
        throw err
      })
  } catch (err) {
    log.controller.warning('dbrestore', err)
  }
}

exports.sharded = async (bot, message) => {
  try {
    const results = await bot.shard.broadcastEval(`require(require('path').dirname(require.main.filename) + '/util/storage.js').scheduleManager.cyclesInProgress() ? true : false`)
    for (var i = 0; i < results.length; ++i) {
      if (results[i]) return await message.channel.send(`Unable to start restore while a retrieval cycle is in progress. Try again later.`)
    }

    const archive = message.attachments.first()
    if (!archive) return await message.channel.send('No archive found as an attachment.')

    const fileName = archive.filename
    if (!fileName.endsWith('.archive')) return await message.channel.send('That is not a valid archive to restore.')
    console.log(`Bot Controller: Database restore has been started by ${message.author.username}`)
    const m = await message.channel.send('Restoring...')
    process.send({ _drss: true, type: 'dbRestore', fileName: fileName, url: archive.url, channelID: message.channel.id, messageID: m.id, databaseName: DATABASE_NAME })
  } catch (err) {
    log.controller.warning('dbrestore', err)
  }
}

exports.restoreUtil = (m, fileName, url, databaseName = DATABASE_NAME) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(fileName)
    needle.get(url).pipe(file).on('finish', () => restoreTest(m))

    function restoreTest (m) {
      restore(fileName, databaseName, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Bot Controller: Database restore failed:`, err.message))
          if (m) m.edit(`Unable to restore, an error has occured. See console for details.`).catch(err => console.log(`Bot Controller: Unable to edit restoring message to error for dbrestore:`, err.message || err))
          return
        }
        dropDatabase(m)
      })
    }

    function dropDatabase (m) {
      mongoose.connection.db.dropDatabase(err => {
        if (err) return reject(new Error(`Bot Controller: Unable to drop database ${databaseName} for dbrestore:`, err.message))
        restoreFinal(m)
      })
    }

    function restoreFinal (m) {
      restore(fileName, databaseName, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Bot Controller: Database restore failed:`, err.message))
          if (m) m.edit(`Unable to restore, an error has occured. See console for details.`).catch(err => console.log(`Bot Controller: Unable to edit restoring message to error for dbrestore:`, err.message || err))
          return
        }
        if (stderr) console.info(stderr)
        else if (stdout) console.info(stdout)
        deleteTemp(m)
      })
    }

    function deleteTemp (m) {
      fs.unlink(fileName, err => {
        if (err) console.log(`Bot Controller: Unable to remove temp file ./${fileName} after restore for dbrestore:`, err.message || err)
        console.log('Bot Controller: Database restore is complete. The database has been wiped clean with the backup guilds collection restored. The process will stop for a manual reboot.')
        if (!m) return resolve()
        m.edit('Database restore complete! Stopping bot process for manual reboot.')
          .then(() => resolve())
          .catch(err => console.log(`Bot Controller: Unable to edit restoring message to success for dbrestore:`, err.message || err))
      })
    }
  })
}
