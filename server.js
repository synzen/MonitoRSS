const fs = require('fs')
const path = require('path')
const DiscordRSS = require('./index.js')
const schedulesPath = path.join(__dirname, 'settings', 'schedules.json')
const schedules = fs.existsSync(schedulesPath) ? JSON.parse(fs.readFileSync(schedulesPath)) : {}
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings', 'config.json')))

const clientManager = new DiscordRSS.ClientManager({
  setPresence: true,
  schedules,
  config
})

clientManager.run()
