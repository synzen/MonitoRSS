const storage = require('../util/storage.js')
const config = require('../config.json')
const log = require('../util/logger.js')
const dbOps = require('../util/dbOps.js')
const timeLimited = {}

async function switchServerArg (bot, message, args) {
  try {
    const action = args.shift() // Third arg
    if (!action) return await message.channel.send('You must specify either `add` or `remove` as your third argument.')
    let server = args.shift() // Fourth arg
    if (action !== 'list' && !server) return await message.channel.send('You must specify the server ID, or `this` (to specify this server) as your fourth argument..')
    if (server === 'this') server = message.guild.id
    switch (action) {
      case 'add':
        const vipUser = storage.vipUsers[message.author.id]
        if ((vipUser.maxServers && vipUser.servers.length >= vipUser.maxServers) || (!vipUser.maxServers && vipUser.servers.length === 1)) return await message.channel.send(`You cannot add any more servers for your patron status. Your maximum is ${vipUser.maxServers ? vipUser.maxServers : 1}.`)
        const m = await message.channel.send(`Adding server ${server}...`)
        dbOps.vips.addServers({ ...storage.vipUsers[message.author.id], serversToAdd: [server] }, (err, added, failed) => {
          let content = ''
          if (err) content = `Failed to process due to internal error.`
          else {
            if (Object.keys(added).length > 0) {
              content += `The following server(s) have been successfully added:\n`
              for (var aId in added) content += `\n${aId}${added[aId] ? ` (${added[aId]})` : ``}`
              content += '\n\n'
            }
            if (failed.length > 0) {
              content += 'The following server(s) could not be added because they do not exist for this bot:\n'
              for (var a in failed) content += `\n${failed[a]}`
            }
          }
          m.edit(content).catch(err => log.command.warning(`rsspatron servers 1`, err))
        })
        break
      case 'remove':
        if (!storage.vipServers[server] && !storage.vipUsers[message.author.id].servers.includes(server)) return await message.channel.send('That server does not have a patron backing.')
        const m2 = await message.channel.send(`Removing server ${server}...`)
        dbOps.vips.removeServers({ ...storage.vipUsers[message.author.id], serversToRemove: [server] }, (err, added, failed) => {
          let content = ''
          if (err) content = `Failed to process due to internal error.`
          else {
            if (Object.keys(added).length > 0) {
              content += `The following server(s) have been successfully removed:\n`
              for (var rId in added) content += `\n${rId}${added[rId] ? ` (${added[rId]})` : ``}`
              content += '\n\n'
            }
            if (failed.length > 0) {
              content += 'The following server(s) could not be removed because they are not backed by your patron status:\n'
              for (var r in failed) content += `\n${failed[r]}`
            }
          }
          if (err) {
            log.general.warning(`Unable to remove patron backing from server ${server}`, err)
            return m.edit(`Unable to remove your patron backing from ${server}. Reason: ${err.message}`)
          }
          m2.edit(content).catch(err => log.command.warning(`rsspatron servers 2`, err))
        })
        break

      case 'list':
        const vip = storage.vipUsers[message.author.id]
        if (!vip || !vip.servers || vip.servers.length === 0) return await message.channel.send(`You have no servers under your patron backing. The maximum number of servers you may have under your patron backing is ${vip.maxServers ? vip.maxServers : 1}.`)
        const myServers = vip.servers
        let content = `The maximum number of servers you may add your patron backing to is ${vip.maxServers ? vip.maxServers : 1}. The following guilds are backed by your patron status:\n\n`
        for (var l = 0; l < myServers.length; ++l) {
          const id = myServers[l]
          const myServer = storage.vipServers[id]
          content += `${id}${myServer && myServer.name ? ` (${myServer.name})` : ``}\n`
        }
        await message.channel.send(content)
        break

      default:
        await message.channel.send('Invalid command usage.')
    }
  } catch (err) {
    log.command.warning('rsspatron servers', err)
  }
}

module.exports = async (bot, message) => {
  try {
    if (!storage.vipUsers[message.author.id]) return await message.channel.send('You must be a patron to use this command.')
    const args = message.content.toLowerCase().split(' ').map(item => item.trim())
    args.shift() // Remove prefix
    if (args.length === 0) {
      return await message.channel.send(`Proper usage:

\`${config.bot.prefix}rsspatron servers add <server id>\` - Add your patron backing to a server via server ID or \`this\` for this server
\`${config.bot.prefix}rsspatron servers remove <server id>\` - Remove your patron backing from a server via server ID or \`this\` for this server
\`${config.bot.prefix}rsspatron servers list\` - List servers under your patron backing, and the maximum number of servers you may have
`)
    }
    const type = args.shift() // Second arg
    switch (type) {
      case 'servers':
        switchServerArg(bot, message, args)
        break
      case 'refresh':
        if (timeLimited[message.author.id]) {
          log.command.warning('Blocked refresh due to time limit', message.author)
          return await message.channel.send(`${message.author.toString()} Please wait 5 minutes after the last use of this command before using it again.`)
        }
        timeLimited[message.author.id] = true
        setTimeout(() => delete timeLimited[message.author.id], 300000) // 5 minutes
        const m = await message.channel.send('Refreshing...')
        dbOps.vips.refresh(async err => {
          try {
            if (err) {
              log.command.error('Failed to update VIPs', message.author, err)
              return await m.edit(`Failed to refresh patrons: ` + err.message)
            }
            log.command.success(`Refreshed VIPs`, message.author)
            await m.edit(`Successfully updated patrons.`)
          } catch (err) {
            log.command.warning('rsspatron 2', err, message.author)
          }
        })
        break
      default:
        await message.channel.send('Invalid command usage')
    }
  } catch (err) {
    log.command.warning('rsspatron', err, message.author)
  }
}
