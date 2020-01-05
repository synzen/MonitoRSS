const fetch = require('node-fetch')
const GuildData = require('../../structs/GuildData.js')
const log = require('../../util/logger.js')

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
    throw new Error(`Non-200 status code: `, res.status)
  }
  const file = await res.json()
  return file
}

exports.normal = async (bot, message) => {
  try {
    const file = await getID(message)
    const guildData = new GuildData(file)
    const id = guildData.id
    const guild = bot.guilds.get(id)
    if (!guild) {
      return await message.chanel.send(`Unable to restore server, ID ${id} was not found in cache.`)
    }
    await guildData.restore()
    log.owner.success(`Server (ID: ${id}, Name: ${guild.name}) has been restored`, message.author)
    await message.channel.send(`Server (ID: ${id}, Name: ${guild.name}) has been restored.`)
  } catch (err) {
    log.owner.warning(`restore`, message.author, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('restore 1a', message.guild, err))
  }
}

exports.sharded = async (bot, message) => {
  try {
    const file = await getID(message)
    const guildData = new GuildData(file)
    const id = guildData.id
    const res = await bot.shard.broadcastEval(`
      const guild = this.guilds.get('${id}');
      guild ? guild.name : null
    `)
    for (var i = 0; i < res.length; ++i) {
      if (!res[i]) continue
      await guildData.restore()
      log.owner.success(`Server (ID: ${id}, Name: ${res[i]}) has been restored`, message.author)
      await message.channel.send(`Server (ID: ${id}, Name: ${res[i]}) has been restored.`)
    }
    await message.chanel.send(`Unable to restore server, guild ${id} was not found in cache.`)
  } catch (err) {
    log.owner.warning(`restore`, message.author, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.owner.warning('restore 1b', message.guild, err))
  }
}
