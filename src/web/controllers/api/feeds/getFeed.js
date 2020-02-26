const fetch = require('node-fetch')
const feedServices = require('../../../services/feed.js')
const createError = require('../../../util/createError.js')

function getFeed (profile) {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async function controller (req, res) {
    const feedUrl = req.params.url
    let allPlaceholders = []
    let xmlStr = ''

    try {
      allPlaceholders = await feedServices.getFeedPlaceholders(feedUrl, profile)
    } catch (err) {
      if (err.message.includes('valid feed')) {
        const resError = createError(40002, err.message)
        return res.status(400).json(resError)
      } else {
        const resError = createError(500, err.message)
        return res.status(500).json(resError)
      }
    }
    try {
      const res = await fetch(feedUrl)
      if (res.status !== 200) {
        const resError = createError(500, `Bad status code (${res.status})`)
        return res.status(500).json(resError)
      }
      xmlStr = await res.text()
    } catch (err) {
      const resError = createError(500, err.message)
      return res.status(500).json(resError)
    }

    res.json({ placeholders: allPlaceholders, xml: xmlStr })
  }
  return controller
}

module.exports = getFeed
