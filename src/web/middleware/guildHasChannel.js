const guildServices = require('../services/guild.js')
const createError = require('../util/createError.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function guildHasChannel (req, res, next) {
  const guildID = req.params.guildID
  const channelID = req.body.channel

  try {
    const has = await guildServices.guildHasChannel(guildID, channelID)
    if (!has) {
      const createdError = createError(404, 'Unknown channel')
      res.status(404).json(createdError)
    } else {
      next()
    }
  } catch (err) {
    next(err)
  }
}

module.exports = guildHasChannel
