
const storage = require('../../util/storage.js')
const currentGuilds = storage.currentGuilds
const needle = require('needle')
const fileOps = require('../../util/fileOps.js')

function getID (message) {
  return new Promise((resolve, reject) => {
    const arr = message.content.split(' ')
    const id = arr[1]
    if (!id) return reject(new Error('No ID found'))
    const attachment = message.attachments.first()
    const url = attachment ? attachment.url : undefined
    if (!url) return reject(new Error('No attachment found'))
    needle('get', url).then(res => {
      if (res.statusCode !== 200) return reject(new Error(`Non-200 status code: `, res))
      try {
        const file = JSON.parse(JSON.stringify(res.body))
        delete file._id
        delete file.__v
        if (!file.id) return reject(new Error('No ID found in file'))
        resolve(file)
      } catch (err) { reject(err) }
    }).catch(reject)
  })
}

exports.normal = async (bot, message) => {
  try {
    const file = await getID(message)
    const id = file.id
    if (!bot.guilds.has(id)) return await message.chanel.send(`Unable to restore server, ID ${id} was not found in bot's cache.`)
    currentGuilds.set(id, file)
    fileOps.updateFile(id, file)
    await message.channel.send(`Server (ID: ${id}, Name: ${bot.guilds.get(id).name}) has been restored.`)
  } catch (err) {
    message.channel.send(err.message).catch(console.log)
    console.log(`Bot Controller: Error encountered while restoring server:`, err.message || err)
  }
}

exports.sharded = async (bot, message) => {
  try {
    const file = await getID(message)
    const id = file.id
    const res = await bot.shard.broadcastEval(`this.guilds.has('${id}')`)
    for (var i = 0; i < res.length; ++i) {
      if (!res[i]) continue
      // currentGuilds.set(id, file) // Let the sharding manager handle the currentGuilds update
      fileOps.updateFile(id, file)
      await message.channel.send(`Server (ID: ${id}, Name: ${bot.guilds.get(id).name}) has been restored.`)
    }
  } catch (err) {
    message.channel.send(err.message).catch(console.log)
    console.log(`Bot Controller: Error encountered while restoring server:`, err.message || err)
  }
}
