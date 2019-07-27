// This logic that stems from this file will automatically create a sharding manager and shards if necessary, if the original client cannot handle the number of guilds

const DiscordRSS = require('./index.js')
const config = require('./config.js')
const fs = require('fs')
const path = require('path')
const schedulesPath = path.join(__dirname, 'settings', 'schedules.json')
const schedules = fs.existsSync(schedulesPath) ? JSON.parse(fs.readFileSync(schedulesPath)) : []

const drss = new DiscordRSS.Client({ setPresence: true }, schedules)
let token = config.bot.token

drss.login(token)
