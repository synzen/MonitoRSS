const fs = require('fs')
const path = require('path')
const Discord = require('discord.js')
const DiscordRSS = require('./src/index.js')
const schedulesPath = path.join(__dirname, 'settings', 'schedules.json')
const schedules = fs.existsSync(schedulesPath) ? JSON.parse(fs.readFileSync(schedulesPath)) : []

const shardingManager = new Discord.ShardingManager('./server-shard.js', { respawn: false })
const clientManager = new DiscordRSS.ClientManager(shardingManager, { setPresence: true }, schedules)

clientManager.run()
