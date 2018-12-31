const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  try {
    const m = await message.channel.send('Generating...')
    const guilds = []
    bot.guilds.forEach(guild => {
      guilds.push({
        id: guild.id,
        name: guild.name,
        members: guild.memberCount,
        owner: guild.owner ? {
          id: guild.owner.id,
          name: guild.owner.user.username
        } : undefined
      })
    })
    guilds.sort((a, b) => b.members - a.members)
    let txt = ''
    guilds.forEach(item => {
      txt += `[${item.members}] (G: ${item.id}, ${item.name}) ${item.owner ? `(O: ${item.owner.id}, ${item.owner.name})` : `(O: None)`} \n`
    })
    await m.delete()
    await message.channel.send({
      files: [
        {
          attachment: Buffer.from(txt, 'utf8'),
          name: 'guilds.txt'
        }
      ]
    })
  } catch (err) {
    log.controller.warning('listguilds', message.author, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('listguilds 1a', message.guild, err))
  }
}

exports.sharded = async (bot, message) => {
  try {
    const m = await message.channel.send('Generating...')
    const results = await bot.shard.broadcastEval(`
            const guilds = []
            this.guilds.forEach(guild => {
                guilds.push({
                    id: guild.id,
                    name: guild.name,
                    members: guild.memberCount,
                    owner: guild.owner ? {
                        id: guild.owner.id,
                        name: guild.owner.user.username
                    } : undefined
                })
            })
            guilds
        `)
    let allGuilds = []
    results.forEach(item => {
      allGuilds = allGuilds.concat(item)
    })
    allGuilds.sort((a, b) => b.members - a.members)
    let txt = ''
    allGuilds.forEach(item => {
      txt += `[${item.members}] (G: ${item.id}, ${item.name}) ${item.owner ? `(O: ${item.owner.id}, ${item.owner.name})` : `(O: None)`} \n`
    })
    await m.delete()
    await message.channel.send({
      files: [
        {
          attachment: Buffer.from(txt, 'utf8'),
          name: 'guilds.txt'
        }
      ]
    })
  } catch (err) {
    log.controller.warning(`listguilds`, message.author, err, true)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.controller.warning('listguilds 1b', message.guild, err))
  }
}
