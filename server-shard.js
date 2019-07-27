// Create a single client

const DiscordRSS = require('./index.js')
const fs = require('fs')
const path = require('path')
const schedulesPath = path.join(__dirname, 'settings', 'schedules.json')
const schedules = fs.existsSync(schedulesPath) ? JSON.parse(fs.readFileSync(schedulesPath)) : []

const drss = new DiscordRSS.Client({ setPresence: true }, schedules) // Override default config values here

drss.login(require(path.join(__dirname, 'config.js')).bot.token, true)
