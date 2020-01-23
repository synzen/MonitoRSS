const guildHasChannel = require('./guildHasChannel.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function guildHasChannelOptional (req, res, next) {
  const channelID = req.body.channelID
  if (channelID) {
    return guildHasChannel(req, res, next)
  } else {
    next()
  }
}

module.exports = guildHasChannelOptional
