const Discord = require('discord.js')
const config = require('./config.json')
if (config.logging.logDates === true) require('./util/logDates.js')()

const Manager = new Discord.ShardingManager('./server.js', {respawn: false})

let missingGuilds = {}
let shardInitsFinished = 0

if (!config.advanced || typeof config.advanced.shards !== 'number' || config.advanced.shards < 1) {
  if (!config.advanced) config.advanced = {}
  config.advanced.shards = 1
  console.log('SH MANAGER: No valid shard count found in config, setting default of 1')
}

Manager.spawn(config.advanced.shards)

Manager.on('message', function (shard, message) {
  if (message === 'kill') process.exit()
  if (message.type === 'missingGuild') {
    if (!missingGuilds[message.content]) missingGuilds[message.content] = 1
    else missingGuilds[message.content]++
  }

  if (message.type === 'initComplete') {
    shardInitsFinished++
    if (shardInitsFinished === Manager.totalShards) {
      for (var guildId in missingGuilds) {
        if (missingGuilds[guildId] === Manager.totalShards) console.log('SH MANAGER: WARNING - Missing Guild from bot lists: ' + guildId)
      }
    }
  }
})
