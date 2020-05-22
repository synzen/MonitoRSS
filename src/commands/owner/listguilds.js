module.exports = async (message) => {
  const m = await message.channel.send('Generating...')
  const results = await message.client.shard.broadcastEval(`
          const guilds = []
          this.guilds.cache.forEach(guild => {
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
    txt += `[${item.members}] (G: ${item.id}, ${item.name}) ${item.owner ? `(O: ${item.owner.id}, ${item.owner.name})` : '(O: None)'} \n`
  })
  await m.delete()
  await message.channel.send({
    files: [{
      attachment: Buffer.from(txt, 'utf8'),
      name: 'guilds.txt'
    }]
  })
}
