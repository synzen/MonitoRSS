const configuration = require('../config')
const fetch = require('node-fetch')

async function checkDeliveryService () {
  const config = configuration.get()
  const { deliveryServiceURL, bot } = config
  if (!deliveryServiceURL) {
    return
  }
  const res = await fetch(`${deliveryServiceURL}/ping`, {
    headers: {
      Authorization: `Bot ${bot.token}`
    }
  })
  if (!res.ok) {
    throw new Error(`Bad status code ${res.status}`)
  }
}

module.exports = checkDeliveryService
