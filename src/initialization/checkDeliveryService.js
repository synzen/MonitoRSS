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
  // Health check port is the tcp port plus one
  const toFetch = `http://${hostname}:${Number(port) + 1}/health`
  const res = await fetch(toFetch)
  if (!res.ok) {
    throw new Error(`Bad status code ${res.status}`)
  }
}

module.exports = checkDeliveryService
