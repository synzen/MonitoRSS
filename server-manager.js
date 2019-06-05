// Only create the Sharding Manager
const config = require('./config.js')
const DiscordRSS = require('./index.js')
const Discord = require('discord.js')
const shardingManager = new Discord.ShardingManager('./server-shard.js', { respawn: false })
const clientManager = new DiscordRSS.ClientManager(shardingManager, { readFileSchedules: true, setPresence: true, forceSharded: true })

clientManager.run()

clientManager.once('finishInit', () => {
  // Do whatever once the sharding manager has finished spawning and waiting for all shards to finish initialization
  try {
    require('./web/index.js')()
  } catch (err) {
    if (config.web.enabled === true) console.log(err)
  }
})
