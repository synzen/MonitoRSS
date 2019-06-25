// Only create the Sharding Manager
const DiscordRSS = require('./index.js')
const Discord = require('discord.js')
const shardingManager = new Discord.ShardingManager('./server-shard.js', { respawn: false })
const clientManager = new DiscordRSS.ClientManager(shardingManager, { readFileSchedules: true, setPresence: true, forceSharded: true })

clientManager.run()
