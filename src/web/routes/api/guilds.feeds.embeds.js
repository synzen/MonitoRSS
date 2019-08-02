const express = require('express')
const feedEmbed = express.Router({ mergeParams: true })
const dbOpsGuilds = require('../../../util/db/guilds.js')
const VALID_EMBED_KEYS_LENGTHS = {
  title: 256,
  description: 2048,
  url: -1,
  color: -1,
  footerIconUrl: -1,
  footer_icon_url: -1,
  footerText: 2048,
  footer_text: 2048,
  authorIconUrl: -1,
  author_icon_url: -1,
  authorName: 256,
  author_name: 256,
  authorUrl: -1,
  author_url: -1,
  thumbnailUrl: -1,
  thumbnail_url: -1,
  imageUrl: -1,
  image_url: -1,
  timestamp: -1,
  fields: -1
}
const NON_STRING_KEYS = ['color', 'fields']
const VALID_FIELD_KEYS = {
  title: { type: String, maxLength: 256 },
  value: { type: String, maxLength: 1024 },
  inline: { type: Boolean }
}
const isObject = obj => typeof obj === 'object' && obj !== null && !Array.isArray(obj)

function idChecker (req, res, next) {
  const embedID = req.params.embedID
  if (isNaN(embedID) || !Number.isInteger(+embedID) || +embedID < 0) return res.status(400).json({ code: 400, message: 'ID in parameter must be an integer greater than or equal to 0' })
  if (+embedID > 8) return res.status(400).json({ code: 400, message: 'ID in parameter is out of bounds, must be less than 8' })
  next()
}

function embedExists (req, res, next) {
  const embeds = req.source.embeds
  const embedID = req.params.embedID
  if (!embeds || !embeds[embedID]) return res.status(404).json({ code: 404, message: 'Unknown embed' })
  next()
}

async function deleteEmbed (req, res, next) {
  try {
    const embedID = req.params.embedID
    req.source.embeds.splice(embedID, 1)
    const result = await dbOpsGuilds.update(req.guildRss)
    req.deleteResult = result
    next()
  } catch (err) {
    next(err)
  }
}

async function patchEmbed (req, res, next) {
  try {
    const currentEmbeds = req.source.embeds
    const lastCurrentEmbedIndex = currentEmbeds ? currentEmbeds.length - 1 : -1

    // This check will also work for an id of "0" since it is initially a string
    const embedID = +req.params.embedID // Convert to a number. Middleware already made sure it is an non-negative integer.
    if (embedID > lastCurrentEmbedIndex + 1) return res.status(400).json({ code: 400, message: 'ID in parameter is out of bounds. Must be at a maximum of the current length' })
    const newEmbedProperties = req.body
    if (Object.keys(newEmbedProperties).length === 0) return res.status(400).json({ code: 400, message: 'Must have at least one value in body' })

    if (!req.source.webhook && req.source.embeds && embedID !== 0) return res.status(403).json({ code: 403, message: 'Sources with no webhooks may only edit the 0th embed' })

    // Validate the keys
    const errors = {}
    for (const key in newEmbedProperties) {
      const userVal = newEmbedProperties[key]
      const maxLen = VALID_EMBED_KEYS_LENGTHS[key]
      if (!maxLen) errors[key] = `Invalid setting`
      else if (!NON_STRING_KEYS.includes(key) && typeof userVal !== 'string') errors[key] = 'Must be a string'
      else if (key === 'color' && userVal !== '' && typeof userVal !== 'number') errors[key] = `Must be a number`
      else if (key === 'timestamp' && userVal !== 'now' && userVal !== 'article' && userVal !== '') errors[key] = `Must be "article", "now" or an empty string`
      else if (maxLen !== -1 && userVal.length > maxLen) errors[key] = `Exceeds character limit of ${maxLen}`
      else if (key === 'fields') {
        if (userVal !== '' && !Array.isArray(userVal)) errors[key] = `Must be an array`
        else if (Array.isArray(userVal) && userVal.length === 0) errors[key] = 'Must be populated if array'
        else {
          // Iterate over each field object
          for (let i = 0; i < userVal.length; ++i) {
            const item = userVal[i]
            if (!isObject(item)) errors[key] = 'Must be an array of JSON objects'
            else if (Object.keys(item).length === 0) errors[key] = 'Must be an array of populated JSON objects'
            else if (!item.title || !item.value) errors[key] = `Object keys "title" and "value" are required for every array object in fields`
            else {
              // Iterate over each key in the field object
              for (const fieldKey in item) {
                const fieldValue = item[fieldKey]
                if (!VALID_FIELD_KEYS[fieldKey]) errors[key] = `Invalid setting for field object`
                else if (item[fieldKey].constructor !== VALID_FIELD_KEYS[fieldKey].type) errors[key] = `Invalid type for embed object key "${fieldKey}". Must be a ${VALID_FIELD_KEYS[fieldKey].constructor.name}`
                else if (typeof fieldValue === 'string' && !fieldValue) errors[key] = 'Embed object keys must be defined'
                else if (typeof fieldValue === 'string' && fieldValue.length > VALID_FIELD_KEYS[fieldKey].maxLength) errors[key] = `Object key "${fieldKey}" exceeds character limit of ${VALID_FIELD_KEYS[fieldKey].maxLength}`
              }
            }
          }
        }
      }
    }
    // Send errors if there are any
    if (Object.keys(errors).length > 0) return res.status(400).json({ code: 400, message: errors })

    // Now make the actual changes
    if (!Array.isArray(req.source.embeds)) req.source.embeds = []
    if (embedID === lastCurrentEmbedIndex + 1) {
      // Remove empty values
      for (const key in newEmbedProperties) {
        if (newEmbedProperties[key] === undefined || newEmbedProperties[key] === null) delete newEmbedProperties[key]
      }
      req.source.embeds.push(newEmbedProperties)
    } else {
      if (!req.source.embeds[embedID]) return res.status(400).json({ code: 400, message: `Modifying undefined embed object at index ${embedID}` })
      for (const key in VALID_EMBED_KEYS_LENGTHS) {
        if (newEmbedProperties[key] === '') delete req.source.embeds[embedID][key]
        else if (newEmbedProperties[key] !== undefined && newEmbedProperties[key] !== null) req.source.embeds[embedID][key] = newEmbedProperties[key]
      }

      // Clean up
      for (let i = req.source.embeds.length - 1; i >= 0; --i) {
        if (Object.keys(req.source.embeds[i]).length === 0) req.source.embeds.splice(i, 1)
      }
      if (req.source.embeds.length === 0) delete req.source.embeds
    }

    const result = await dbOpsGuilds.update(req.guildRss)
    req.patchResult = result
    next()
  } catch (err) {
    console.log(err)
    next(err)
  }
}

feedEmbed.patch('/:embedID', idChecker, patchEmbed)
feedEmbed.delete('/:embedID', idChecker, embedExists, deleteEmbed)

module.exports = {
  constants: {
    VALID_EMBED_KEYS_LENGTHS,
    NON_STRING_KEYS,
    VALID_FIELD_KEYS
  },
  middleware: {
    idChecker,
    embedExists
  },
  routes: {
    patchEmbed,
    deleteEmbed
  },
  router: feedEmbed
}
