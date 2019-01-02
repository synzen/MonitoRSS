const config = require('../config.js')
const log = require('../util/logger.js')
const dbOps = require('../util/dbOps.js')
const helpText = guildRss => `Proper usage:

\`${guildRss.prefix || config.bot.prefix}rsspatron servers add <server id>\` - Add your patron backing to a server via server ID or \`this\` for this server
\`${guildRss.prefix || config.bot.prefix}rsspatron servers remove <server id>\` - Remove your patron backing from a server via server ID or \`this\` for this server
\`${guildRss.prefix || config.bot.prefix}rsspatron servers list\` - List servers under your patron backing, and the maximum number of servers you may have
`

async function verifyServer (bot, serverId) {
  if (bot.shard && bot.shard.count > 0) {
    const results = (await bot.shard.broadcastEval(`
      const guild = this.guilds.get('${serverId}')
      guild ? { name: guild.name, id: guild.id } : null
    `)).filter(item => item)

    if (results.length > 0) return results[0]
  } else return bot.guilds.get(serverId)
}

async function switchServerArg (bot, message, args, vipUser, guildRss) {
  try {
    const action = args.shift() // Third arg
    if (!action) return await message.channel.send('You must specify either `add` or `remove` as your third argument.')
    let server = args.shift() // Fourth arg
    if (action !== 'list' && !server) return await message.channel.send('You must specify the server ID, or `this` (to specify this server) as your fourth argument..')
    if (server === 'this') server = message.guild.id

    if (action === 'add') {
      if ((vipUser.maxServers && vipUser.servers.length >= vipUser.maxServers) || (!vipUser.maxServers && vipUser.servers.length === 1)) return await message.channel.send(`You cannot add any more servers for your patron status. Your maximum is ${vipUser.maxServers ? vipUser.maxServers : 1}.`)
      if (vipUser.servers.includes(server)) return await message.channel.send(`That server already has your patron backing.`)
      const m = await message.channel.send(`Adding server ${server}...`)
      const gotServer = await verifyServer(bot, server)
      if (!gotServer) return await m.edit(`Unable to add server \`${server}\`. Either it does not exist, or I am not in it.`)
      await dbOps.vips.addServers({ vipUser, serversToAdd: [server] })
      await m.edit(`Successfully added ${server} (${gotServer.name})`)
    } else if (action === 'remove') {
      if (!vipUser.servers.includes(server)) return await message.channel.send(`That server does not have your patron backing.`)
      const m2 = await message.channel.send(`Removing server ${server}...`)
      await dbOps.vips.removeServers({ vipUser, serversToRemove: [server] })
      await m2.edit(`Successfully removed`)
    } else if (action === 'list') {
      if (!vipUser.servers || vipUser.servers.length === 0) return await message.channel.send(`You have no servers under your patron backing. The maximum number of servers you may have under your patron backing is ${vipUser.maxServers ? vipUser.maxServers : 1}.`)
      const myServers = vipUser.servers
      let content = `The maximum number of servers you may add your patron backing to is ${vipUser.maxServers ? vipUser.maxServers : 1}. The following guilds are backed by your patron status:\n\n`
      for (const id of myServers) {
        const gotServer = await verifyServer(bot, id)
        content += gotServer ? `${gotServer.id} (${gotServer.name})\n` : `${gotServer.id} (Unknown)\n`
      }

      await message.channel.send(content)
    } else {
      await message.channel.send(`Invalid command usage. ${helpText(guildRss)}`)
    }
  } catch (err) {
    log.command.warning('rsspatron servers', message.guild, err, true)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsspatron servers', message.guild, err))
  }
}

module.exports = async (bot, message) => {
  try {
    const [ guildRss, vipUser ] = await Promise.all([ dbOps.guildRss.get(message.guild.id), dbOps.vips.get(message.author.id) ])

    if (!vipUser || vipUser.invalid === true) return await message.channel.send('You must be a patron to use this command.')
    const args = message.content.toLowerCase().split(' ').map(item => item.trim())
    args.shift() // Remove prefix
    if (args.length === 0) {
      return await message.channel.send(helpText(guildRss))
    }
    const type = args.shift() // Second arg
    if (type === 'servers') switchServerArg(bot, message, args, vipUser, guildRss)
    else await message.channel.send(`Invalid command usage. ${helpText(guildRss)}`)
    // switch (type) {
    //   case 'servers':

    //     break
    // case 'refresh':
    //   if (timeLimited[message.author.id]) {
    //     log.command.warning('Blocked refresh due to time limit', message.author)
    //     return await message.channel.send(`${message.author.toString()} Please wait 5 minutes after the last use of this command before using it again.`)
    //   }
    //   timeLimited[message.author.id] = true
    //   setTimeout(() => delete timeLimited[message.author.id], 300000) // 5 minutes
    //   const m = await message.channel.send('Refreshing...')
    //   dbOps.vips.refresh(async err => {
    //     try {
    //       if (err) {
    //         log.command.error('Failed to update VIPs', message.author, err)
    //         return await m.edit(`Failed to refresh patrons: ` + err.message)
    //       }
    //       log.command.success(`Refreshed VIPs`, message.author)
    //       await m.edit(`Successfully updated patrons.`)
    //     } catch (err) {
    //       log.command.warning('rsspatron 2', err, message.author)
    //     }
    //   })
    //   break
    // default:
    //   await message.channel.send('Invalid command usage')
    // }
  } catch (err) {
    log.command.warning('rsspatron', err, message.author)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsspatron 1', message.guild, err))
  }
}
