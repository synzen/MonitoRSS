const express = require('express')
const router = express.Router()
const axios = require('axios')
const discordAPIConstants = require('../../constants/discordAPI.js')
const discordAPIHeaders = require('../../constants/discordAPIHeaders.js')
const dbOps = require('../../../util/dbOps.js')

// All API routes tries to mirror Discord's own API routes

router.get('/@me', (req, res, next) => {
  axios.get(`${discordAPIConstants.apiHost}/users/@me`, discordAPIHeaders.user(req.session.auth.access_token))
    .then(json => {
      req.session.identity = json.data
      res.json(json.data)
    })
    .catch(next)
})

router.get('/@me/guilds', async (req, res, next) => {
  try {
    const [ apiGuildsRes, guildProfiles ] = await Promise.all([ axios.get(`${discordAPIConstants.apiHost}/users/@me/guilds`, discordAPIHeaders.user(req.session.auth.access_token)), dbOps.guildRss.getAll() ])
    const apiGuilds = apiGuildsRes.data
    const guildProfilesRef = {}
    const toReturn = []
    for (const guildRss of guildProfiles) guildProfilesRef[guildRss.id] = guildRss
    for (const discordGuild of apiGuilds) {
      if (guildProfilesRef[discordGuild.id]) toReturn.push({ profile: guildProfilesRef[discordGuild.id], discord: discordGuild })
    }
    res.json(toReturn)
  } catch (err) {
    next(err)
  }
})

module.exports = router
