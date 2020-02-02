const userServices = require('../../../services/user.js')
const guildServices = require('../../../services/guild.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getMeGuilds (req, res, next) {
  const { identity, token } = req.session
  try {
    const userGuilds = await userServices.getGuildsByAPI(identity.id, token.access_token)
    const guilds = []
    for (const guild of userGuilds) {
      const hasPerm = await userServices.hasGuildPermission(guild)
      if (!hasPerm) {
        continue
      }
      const data = await guildServices.aggregateDataOfGuild(guild.id)
      guilds.push({
        ...guild,
        ...data
      })
    }
    res.json(guilds)
  } catch (err) {
    next(err)
  }
}

module.exports = getMeGuilds
