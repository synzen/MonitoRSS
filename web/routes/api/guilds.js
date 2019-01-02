const express = require('express')
const guilds = express.Router()
const axios = require('axios')
const statusCodes = require('../../constants/codes.js')
const discordAPIConstants = require('../../constants/discordAPI.js')
const MANAGE_CHANNEL_PERMISSION = 16
const ADMINISTRATOR_PERMISSION = 8
const dbOps = require('../../../util/dbOps.js')
const VALID_GUILD_PATCH_TYPES = {
  sendAlertsTo: [String],
  dateFormat: String,
  dateLanguage: String,
  timezone: String,
  prefix: String
}
const BOT_HEADERS = require('../../constants/discordAPIHeaders.js').bot

async function checkUserGuildPermission (req, res, next) {
  try {
    const guildId = req.params.guildId
    const user = req.session.identity.id
    // Check if the user is the owner of the guild or if the user has a role with the correct permission to view the guild profile
    const [ guildJsonRes, rolesArrayRes, memberJsonRes, guildRss ] = await Promise.all([
      axios.get(`${discordAPIConstants.apiHost}/guilds/${guildId}`, BOT_HEADERS),
      axios.get(`${discordAPIConstants.apiHost}/guilds/${guildId}/roles`, BOT_HEADERS),
      axios.get(`${discordAPIConstants.apiHost}/guilds/${guildId}/members/${user}`, BOT_HEADERS),
      dbOps.guildRss.get(guildId)
    ])
    const guildJson = guildJsonRes.data
    const rolesArray = rolesArrayRes.data
    const memberJson = memberJsonRes.data

    // Now check if they have the permissions
    let memberHasPerm = false || guildJson.owner_id === user
    if (!memberHasPerm) {
      for (const roleObject of rolesArray) {
        const roleId = roleObject.id
        if (!memberJson.roles.includes(roleId)) continue
        memberHasPerm = memberHasPerm || ((roleObject.permissions & MANAGE_CHANNEL_PERMISSION) === MANAGE_CHANNEL_PERMISSION) || ((roleObject.permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION)
      }
    }
    if (!memberHasPerm) return res.status(401).json({ code: 401, message: statusCodes['401'].message })
    req.guild = guildJson
    req.guildRoles = rolesArray
    req.guildName = guildJson.name
    req.guildRss = guildRss
    next()
  } catch (err) {
    next(err)
  }
}

guilds.use('/:guildId', checkUserGuildPermission)

guilds.get('/:guildId', async (req, res, next) => {
  try {
    if (!req.guildRss) return res.status(404).json({ code: 404, message: statusCodes['404'].message })
    res.json(req.guildRss)
  } catch (err) {
    console.log(err)
    next(err)
  }
})

// Modify a guild profile, and create it if it doesn't exist before the PATCH
guilds.patch(`/:guildId`, async (req, res, next) => {
  const errors = {}
  const body = req.body
  for (const key in body) {
    const bodyValue = body[key]
    const wantedType = VALID_GUILD_PATCH_TYPES[key]
    if (!wantedType) errors[key] = 'Invalid setting'
    if (Array.isArray(wantedType)) {
      const arrayOfCorrectTypes = !Array.isArray(bodyValue) || bodyValue.reduce((total, cur) => total || cur.constructor === wantedType[0], false)
      if (!arrayOfCorrectTypes) errors[key] = `Each element of array must be a ${wantedType[0].name}`
    } else if (bodyValue.constructor !== wantedType) errors[key] = `Must be a ${wantedType.name}`
  }
  if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })
  try {
    req.patchResult = await dbOps.guildRss.update({ ...req.body, id: req.params.guildId }, true)
    req.guildRss = await dbOps.guildRss.get(req.params.guildId)
    next()
  } catch (err) {
    next(err)
  }
})

guilds.delete('/:guildId', async (req, res, next) => {
  try {
    req.deleteResult = await dbOps.guildRss.remove({ id: req.params.guildId }, true)
    next()
  } catch (err) {
    next(err)
  }
})

module.exports = guilds
