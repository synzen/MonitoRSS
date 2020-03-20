const subscriberServices = require('../../../../../services/subscriber.js')
const roleServices = require('../../../../../services/role.js')
const userServices = require('../../../../../services/user.js')
const createError = require('../../../../../util/createError.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createSubscriber (req, res, next) {
  const guildID = req.params.guildID
  const data = {
    feed: req.params.feedID,
    id: req.body.id,
    type: req.body.type,
    filters: req.body.filters || {}
  }
  try {
    if (data.type === 'role') {
      const valid = await roleServices.isRoleOfGuild(data.id, guildID)
      if (!valid) {
        const createdError = createError(403, `Role is not part of guild`)
        return res.status(403).json(createdError)
      }
    } else {
      const exists = await userServices.getMemberOfGuild(data.id, guildID)
      if (!exists) {
        const createdError = createError(403, `User is not member of guild`)
        return res.status(403).json(createdError)
      }
    }
    const created = await subscriberServices.createSubscriber(data)
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
}

module.exports = createSubscriber
