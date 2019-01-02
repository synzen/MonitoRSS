const express = require('express')
const router = express.Router({ mergeParams: true })
const axios = require('axios')
const discordAPIConstants = require('../../constants/discordAPI.js')
const BOT_HEADERS = require('../../constants/discordAPIHeaders.js').bot

// All API routes tries to mirror Discord's own API routes

router.get('/:channelId', async (req, res, next) => {
  try {
    const response = await axios.get(`${discordAPIConstants.apiHost}/channels/${req.params.channelId}`, BOT_HEADERS)
    if (response.data.guild_id !== req.params.guildId) return res.status(403).json({ code: 403, message: { channel: 'Not part of guild' } })
    return res.json(response.data)
  } catch (err) {
    next(err)
  }
})

module.exports = router
