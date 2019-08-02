// Only create the Sharding Manager
const DiscordRSS = require('./src/index.js')
const Discord = require('discord.js')
const shardingManager = new Discord.ShardingManager('./server-shard.js', { respawn: false })
const clientManager = new DiscordRSS.ClientManager(shardingManager, { setPresence: true, forceSharded: true })

clientManager.run()
