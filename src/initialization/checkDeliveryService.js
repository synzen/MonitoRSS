const configuration = require('../config')
const fetch = require('node-fetch')
const { URL } = require('url')

async function checkDeliveryService () {
  const config = configuration.get()
  const { deliveryServiceURL } = config
  if (!deliveryServiceURL) {
    return
  }
  const url = new URL(deliveryServiceURL)
  const { hostname, port } = url
  const res = await fetch(`http://${hostname}:${port}/health`)
  if (!res.ok) {
    throw new Error(`Bad status code ${res.status}`)
  }
}

module.exports = checkDeliveryService
