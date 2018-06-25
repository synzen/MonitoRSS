const storage = require('../../util/storage.js')
const dbOps = require('../../util/dbOps.js')
const log = require('../../util/logger.js')

exports.normal = (bot, message) => {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]

  if (!storage.blacklistUsers.includes(id) && !storage.blacklistGuilds.includes(id)) return message.channel.send(`ID ${id} is not blacklisted.`)

  dbOps.blacklists.remove(id, err => {
    if (err) {
      log.controller.error('Unable to remove blacklist', message.author, err)
      return message.channel.send(`Unblacklist failed. ${err.message}`)
    }
    log.controller.success(`Removed ${id} from blacklist`)
    message.channel.send(`Removed ${id} from blacklist.`)
  })
}

exports.sharded = exports.normal
