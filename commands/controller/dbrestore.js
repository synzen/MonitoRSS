const fs = require('fs')
const config = require('../../config.js')
const path = require('path')
const mongoose = require('mongoose')
const spawn = require('child_process').spawn
const log = require('../../util/logger.js')
const BACKUP_TO_PATH = path.join(__dirname, '..', '..', 'settings', 'dbrestore_backup')
const RESTORE_FROM_PATH = path.join(__dirname, '..', '..', 'settings', 'dbbackup')

exports.normal = async (bot, message) => {
  try {
    if (!fs.existsSync(RESTORE_FROM_PATH)) return await message.channel.send(`No dbbackup folder found (\`${RESTORE_FROM_PATH}). Use ${config.bot.prefix}dbbackup first.`)
    const m = await message.channel.send('Restoring...')
    exports.restoreUtil(m, err => {
      if (err) throw err
      process.exit()
    })
  } catch (err) {
    log.controller.warning('dbrestore', err)
  }
}

exports.sharded = async (bot, message) => {
  try {
    if (!fs.existsSync(RESTORE_FROM_PATH)) return await message.channel.send(`No dbbackup folder dump found (\`${RESTORE_FROM_PATH}\`).`)
    const m = await message.channel.send('Restoring...')
    process.send({ _drss: true, type: 'dbRestore', channelID: message.channel.id, messageID: m.id })
  } catch (err) {
    log.controller.warning('dbrestore', err, true)
  }
}

exports.restoreUtil = (m, callback) => {
  backupCurrent()

  function backupCurrent () {
    log.controller.info(`Backing up current database ${mongoose.connection.name} with mongodump to ${BACKUP_TO_PATH}\n`, m ? m.author : null)
    const child = spawn('mongodump', ['--db', mongoose.connection.name, '--out', BACKUP_TO_PATH])
    child.stdout.on('data', data => console.log('stdout: ', data.toString().trim()))
    child.stderr.on('data', data => console.log('stderr: ', data.toString().trim()))
    child.on('close', code => {
      const stringCode = code.toString().trim()
      log.controller.info(`Finished backing up current database, spawn process exited with code ${stringCode}\n`, m ? m.author : null)
      if (code === 0) dumpCurrent()
      else callback(new Error(`Process to back up database exited with non-zero code (${stringCode}), see console`))
    })
  }

  function dumpCurrent () {
    log.controller.info(`Dropping current database ${mongoose.connection.name} through mongoose`, m ? m.author : null)
    mongoose.connection.db.dropDatabase(err => {
      if (err) return callback(err)
      log.controller.info(`Dropped current database successfully\n`)
      restore()
    })
  }

  function restore () {
    log.controller.info(`Restoring database ${mongoose.connection.name} with mongorestore from ${RESTORE_FROM_PATH}`, m ? m.author : null)
    const child = spawn('mongorestore', ['--nsInclude', `${mongoose.connection.name}.*`, RESTORE_FROM_PATH])
    child.stdout.on('data', data => console.log('stdout: ', data.toString().trim()))
    child.stderr.on('data', data => console.log('stderr: ', data.toString().trim()))
    child.on('close', code => {
      const stringCode = code.toString().trim()
      log.controller.info(`Backed up current database, spawn process exited with code ${stringCode}\n`)
      if (code !== 0) {
        if (m) m.edit(`A possible error has occured. See console for details.`).catch(err => log.controller.warning(`Unable to edit restoring message to error for dbrestore:`, m.author, err))
        return callback(new Error(`Process to back up database exited with non-zero code (${stringCode}), see console`))
      }
      if (!m) return callback()
      m.edit('Database restore complete! Stopping bot process for manual reboot.')
        .then(() => callback())
        .catch(err => {
          log.controller.warning(`Unable to edit restoring message to success for dbrestore:`, m.author, err)
          callback()
        })
    })
  }
}
