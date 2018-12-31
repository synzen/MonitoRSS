const path = require('path')
const spawn = require('child_process').spawn
const mongoose = require('mongoose')
const log = require('../../util/logger.js')
const BACKUP_PATH = path.join(__dirname, '..', '..', 'settings', 'dbbackup')

function dump (m, collections, complete = 0) {
  const collection = collections.shift()
  if (!collection) {
    log.controller.info('Database backup complete', m.author)
    return m.edit(`Dumped ${complete}/4 total collections.${complete > 0 ? `. See \`${BACKUP_PATH}\` for the dump folder.` : ''}`).catch(err => log.controller.warning('dbbackup', m.author, err))
  }
  log.controller.info(`Attempting to dump collection ${mongoose.connection.name}.${collection}`)
  const child = spawn('mongodump', ['--db', mongoose.connection.name, '--collection', collection, '--out', BACKUP_PATH])
  child.stdout.on('data', data => console.log('stdout: ', data.toString().trim()))
  child.stderr.on('data', data => console.log('stderr: ', data.toString().trim()))
  child.on('close', code => {
    log.controller.info(code === 0 ? `Successfully dumped collection ${mongoose.connection.name}.${collection} ${BACKUP_PATH}\n` : `Failed to dump collection ${mongoose.connection.name}.${collection} (code ${code.toString().trim()})\n`)
    dump(m, collections, code === 0 ? ++complete : complete) // 0 is successful, 1 is failed
  })
}

exports.normal = (bot, message) => {
  log.controller.info(`Databases backup has been started\n`, message.author)
  message.channel.send('Backing up...')
    .then(m => dump(m, ['guilds', 'vips', 'failed_links', 'guild_backups']))
    .catch(err => log.controller.warning(`Failed to send creating archive message for dbbackup:`, message.author, err))
}

exports.sharded = exports.normal
