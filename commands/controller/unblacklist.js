const storage = require('../../util/storage.js')
const fileOps = require('../../util/fileOps.js')
const log = require('../../util/logger.js')
const blacklistGuilds = storage.blacklistGuilds
const blacklistUsers = storage.blacklistUsers

exports.normal = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const id = content[1]

  if (!blacklistUsers.includes(id) && !blacklistGuilds.includes(id)) return message.channel.send(`ID ${id} is not blacklisted.`)

  fileOps.removeBlacklist(id, err => {
    if (err) {
      log.controller.error('Unable to remove blacklist', message.author, err)
      return message.channel.send(`Unblacklist failed. ${err.message}`)
    }
    message.channel.send(`Removed ${id} from blacklist`)
  })
}

exports.sharded = exports.normal
