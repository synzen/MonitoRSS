const fetch = require('node-fetch')
const GuildData = require('../../structs/GuildData.js')
const createLogger = require('../../util/logger/create.js')

async function getID (message) {
  const arr = message.content.split(' ')
  const id = arr[1]
  if (!id) {
    throw new Error('No ID found. You must pass the server ID as an argument to this command.')
  }
  const attachment = message.attachments.first()
  const url = attachment ? attachment.url : undefined
  if (!url) {
    throw new Error('No attachment found')
  }
  const res = await fetch(url)
  if (res.status !== 200) {
    throw new Error('Non-200 status code: ', res.status)
  }
  const file = await res.json()
  return file
}

module.exports = async (message) => {
  const file = await getID(message)
  const guildData = new GuildData(file)
  const id = guildData.id
  const res = await message.client.shard.broadcastEval(`
    const guild = this.guilds.cache.get('${id}');
    guild ? guild.name : null
  `)
  const log = createLogger(message.guild.shard.id)
  for (var i = 0; i < res.length; ++i) {
    if (!res[i]) continue
    await guildData.restore()
    log.owner({
      user: message.author
    }, `Server (ID: ${id}, Name: ${res[i]}) has been restored`)
    await message.channel.send(`Server (ID: ${id}, Name: ${res[i]}) has been restored.`)
    return
  }
  await message.channel.send(`Unable to restore server, guild ${id} was not found in cache.`)
}
