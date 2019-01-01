const express = require('express')
const router = express.Router()
const axios = require('axios')
const discordAPIConstants = require('../../constants/discordAPI.js')
const discordAPIHeaders = require('../../constants/discordAPIHeaders.js')
const dbOps = require('../../../util/dbOps.js')

// All API routes tries to mirror Discord's own API routes

router.get('/@me', (req, res, next) => {
  axios.get(`${discordAPIConstants.apiHost}/users/@me`, discordAPIHeaders.user(req.session.auth.access_token))
    .then(json => res.json(json.data))
    .catch(next)
})

router.get('/@me/guilds', async (req, res, next) => {
  try {
    const [ apiGuildsRes, guildProfiles ] = await Promise.all([ axios.get(`${discordAPIConstants.apiHost}/users/@me/guilds`, bearerHeaders(req.session.auth.access_token)), dbOps.guildRss.getAll() ])
    const apiGuilds = apiGuildsRes.data
    const guildProfilesRef = {}
    for (const guildRss of guildProfiles) guildProfilesRef[guildRss.id] = guildRss
    const resJson = []
    apiGuilds.forEach(guild => guildProfilesRef[guild.id] ? resJson.push(guildProfilesRef[guild.id]) : null)
    res.json(resJson)
  } catch (err) {
    next(err)
  }
})

module.exports = router
