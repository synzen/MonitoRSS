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
    const [ guildJsonRes, rolesArrayRes, memberJsonRes ] = await Promise.all([
      axios.get(`${discordAPIConstants.apiHost}/guilds/${guildId}`, BOT_HEADERS),
      axios.get(`${discordAPIConstants.apiHost}/guilds/${guildId}/roles`, BOT_HEADERS),
      axios.get(`${discordAPIConstants.apiHost}/guilds/${guildId}/members/${user}`, BOT_HEADERS)
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
    next()
  } catch (err) {
    next(err)
  }
}

async function createUserGuiildProfile (req, res, next) {
  try {
    const guildId = req.params.guildId
    const guildRss = await dbOps.guildRss.get(guildId)
    if (guildRss) {
      req.guildRss = guildRss
      return next()
    }
    const result = await dbOps.guildRss.update({ id: guildId, name: req.guild.name }, true) // req.guild.name is provided through the middleware function checkUserGuildPermission
    if (result.ok !== 1) return res.status(500).json({ code: 500, message: statusCodes['500'].message })
    if (result.n === 0) return res.status(404).json({ code: 404, message: statusCodes['404'].message })
    if (result.nModified !== 1) return res.status(304).json({ code: 304, message: statusCodes['304'].message })
    next()
  } catch (err) {
    next(err)
  }
}

guilds.use('/:guildId', checkUserGuildPermission)

guilds.get('/:guildId', async (req, res, next) => {
  try {
    const guildRss = await dbOps.guildRss.get(req.params.guildId)
    if (!guildRss) return res.status(404).json({ code: 404, message: statusCodes['404'].message })
    res.json(guildRss)
  } catch (err) {
    console.log(err)
    next(err)
  }
})

// Modify a guild profile, and create it if it doesn't exist before the PATCH
guilds.patch(`/:guildId`, (req, res, next) => {
  const errors = {}
  const body = req.body
  for (const key in body) {
    const wantedType = VALID_GUILD_PATCH_TYPES[key]
    if (!wantedType) continue
    if (body[key].constructor !== wantedType || (Array.isArray(wantedType) && body[key].constructor !== wantedType[0])) {
      errors[key] = `Must be a ${Array.isArray(wantedType) ? wantedType[0].name : wantedType.name}`
    }
  }
  if (Object.keys(errors).length > 0) return res.status(403).json({ code: 403, message: errors })
  next()
}, createUserGuiildProfile, async (req, res, next) => {
  try {
    const result = await dbOps.guildRss.update({ ...req.body, id: req.params.guildId }, true)
    if (result.ok !== 1) return res.status(500).json({ code: 500, message: statusCodes['500'].message })
    if (result.n === 0) return res.status(404).json({ code: 404, message: statusCodes['404'].message })
    if (result.nModified !== 1) return res.status(304).json({ code: 304, message: statusCodes['304'].message })
    return res.json({ code: 200, message: 'ok' })
  } catch (err) {
    next(err)
  }

  res.json(req.body)
})

guilds.delete('/:guildId', async (req, res, next) => {
  try {
    const result = await dbOps.guildRss.remove({ id: req.params.guildId })
    if (result.ok !== 1) return res.status(500).json({ code: 500, message: statusCodes['500'].message })
    if (result.n === 0) return res.status(304).json({ code: 304, message: statusCodes['304'].message })
    return res.json({ code: 200, message: 'ok' })
  } catch (err) {
    next(err)
  }
})

module.exports = guilds
