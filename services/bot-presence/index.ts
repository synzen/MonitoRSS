import 'dotenv/config'
import { Client, Events } from 'discord.js'

const token = process.env.BOT_TOKEN

if (!token) {
  throw new Error('Must specify BOT_TOKEN in .env')
}

const client = new Client({
  intents: [],
  shards: 'auto'
})

client.on(Events.ShardReady, id => {
  console.log('Shard ready', id)
})

client.on(Events.ShardError, (err, id) => {
  console.log('Shard error', id, err)
})

client.on(Events.ShardDisconnect, (err, id) => {
  console.log('Shard disconnect', id, err)
})

client.on(Events.ShardReconnecting, id => {
  console.log('Shard reconnecting', id)
})

client.on(Events.ShardResume, (id, replayed) => {
  console.log('Shard resume', id, replayed)
})

client.once(Events.ClientReady, (c) => {
  console.log('Ready as ', c.user?.tag)
})

client.login(token)
