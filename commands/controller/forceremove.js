const config = require('../../config.json')
const storage = require('../../util/storage.js')
const dbOps = require('../../util/dbOps.js')
const channelTracker = require('../../util/channelTracker.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const currentGuilds = storage.currentGuilds
  let content = message.content.split(' ')
  try {
    if (content.length < 2) return await message.channel.send(`The correct syntax is \`${config.bot.prefix}forceremove <keywords> <optional reason>\`.`)
    content.shift()
    let linkPart = content.shift()
    let reason = content.length > 0 ? content.join(' ').trim() : undefined

    const affectedGuilds = []
    const links = []

    currentGuilds.forEach((guildRss, guildId) => {
      let rssList = guildRss.sources

      for (var rssName in rssList) {
        if (rssList[rssName].link.includes(linkPart)) {
          if (!links.includes(rssList[rssName].link)) links.push(rssList[rssName].link)
          if (!affectedGuilds.includes(guildId)) affectedGuilds.push(guildId)
        }
      }
    })

    if (links.length === 0) return await message.channel.send(`No such links of your criteria have been found.`)

    let msg = '```'
    for (var x in links) msg += `\n${links[x]}`
    msg += '```'

    const collector = message.channel.createMessageCollector(m => m.author.id === message.author.id, {time: 240000})
    channelTracker.add(message.channel.id)

    await message.channel.send(`The list of links to be removed ${reason ? 'and the reason for removal ' : ''}is shown below.\n\n${reason ? '```Reason: ' + reason + '```\n' : ''}${msg.length > 1950 ? '```Unable to print links to discord - exceeds 1950 chars. Please see console.```' : msg}\n\nDo you want to continue? Type **Yes** to confirm, or **No** to cancel.`)
    if (msg.length > 1950) {
      log.controller.info(`Links that are about to be forcibly removed:`, message.author)
      for (var a in links) {
        console.info(`\n${links[a]}`)
      }
    }

    collector.on('collect', async m => {
      try {
        if (m.content !== 'Yes' && m.content !== 'No') return await message.channel.send('That is not a valid Option. Please type either **Yes** or **No**.')
        collector.stop()

        if (m.content === 'No') return await message.channel.send(`Force removal canceled.`)
        let removedLinks = []

        for (var i in affectedGuilds) {
          const guildRss = currentGuilds.get(affectedGuilds[i])
          const rssList = guildRss.sources
          let names = []

          for (var name in rssList) {
            for (var e in links) {
              if (rssList[name].link === links[e]) {
                removedLinks.push(links[e])
                names.push(name)
              }
            }
          }

          for (var l in names) {
            const channel = bot.channels.get(rssList[names[l]].channel)
            if (reason && channel) channel.send(`**ATTENTION** - Feeds with link <${rssList[names[l]].link}> have been forcibly removed from all servers. Reason: ${reason}`).catch(err => log.controller.warning(`Could not send force removal notification to server`, channel, err))
            dbOps.guildRss.removeFeed(guildRss, names[l], err => {
              if (err) log.controller.warning(`forceremove error`, err)
            })
          }
        }

        if (removedLinks.length === 0) return await message.channel.send('Unable to remove any links.')

        msg = '```'
        for (var p in removedLinks) msg += `\n${removedLinks[p]}`

        await message.channel.send(`Successfully removed \`${removedLinks.length}\` source(s). Links:\n${msg + '```'}`)
        log.controller.info(`The following links have been forcibly removed: \n${removedLinks}`, message.author)
      } catch (err) {
        log.controller.warning('forceremove 2')
      }
    })

    collector.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => log.controller.warning(`Unable to send expired menu message`, err))
      else if (reason !== 'user') return message.channel.send(reason)
    })
  } catch (err) {
    log.controller.warning('forceremove', err)
  }
}

exports.sharded = async (bot, message, Manager) => {
  let content = message.content.split(' ')
  try {
    if (content.length < 2) return await message.channel.send(`The correct syntax is \`${config.bot.prefix}forceremove <keywords> <optional reason>\`.`)
    content.shift()
    let linkPart = content.shift()
    let reason = content.length > 0 ? content.join(' ').trim() : undefined

    const affectedGuilds = []
    const links = []

    let results = await bot.shard.broadcastEval(`
      const appDir = require('path').dirname(require.main.filename);
      const storage = require(appDir + '/util/storage.js');
      const currentGuilds = storage.currentGuilds;
      const obj = {affectedGuilds: [], links: []};
      const affectedGuilds = obj.affectedGuilds;
      const links = obj.links;

      currentGuilds.forEach(function (guildRss, guildId) {
        let rssList = guildRss.sources;

        for (var rssName in rssList) {
          if (rssList[rssName].link.includes('${linkPart}')) {
            if (!links.includes(rssList[rssName].link)) links.push(rssList[rssName].link);
            if (!affectedGuilds.includes(guildId)) affectedGuilds.push(guildId);
          }
        }
      })


      obj;

    `)
    for (var x in results) {
      if (!results[x]) continue
      const shardLinks = results[x].links
      const shardAffectedGuilds = results[x].affectedGuilds

      for (var y in shardLinks) if (!links.includes(shardLinks[y])) links.push(shardLinks[y])
      for (var z in shardAffectedGuilds) if (!affectedGuilds.includes(shardAffectedGuilds[z])) affectedGuilds.push(shardAffectedGuilds[z])
    }

    if (links.length === 0) return await message.channel.send(`No such links of your criteria have been found.`)

    let msg = '```'
    for (var u in links) msg += `\n${links[u]}`
    msg += '```'

    const collector = message.channel.createMessageCollector(m => m.author.id === message.author.id, {time: 240000})
    channelTracker.add(message.channel.id)

    await message.channel.send(`The list of links to be removed ${reason ? 'and the reason for removal ' : ''}is shown below.\n\n${reason ? '```Reason: ' + reason + '```\n' : ''}${msg.length > 1950 ? '```Unable to print links to discord - exceeds 1950 chars. Please see console.```' : msg}\n\nDo you want to continue? Type **Yes** to confirm, or **No** to cancel.`)
    if (msg.length > 1950) {
      log.controller.info(`Links that are about to be forcibly removed: `, message.author)
      for (var a in links) console.info(`\n${links[a]}`)
    }

    collector.on('collect', async m => {
      try {
        if (m.content !== 'Yes' && m.content !== 'No') return await message.channel.send('That is not a valid Option. Please type either **Yes** or **No**.')
        collector.stop()

        if (m.content === 'No') return await message.channel.send(`Force removal canceled.`)

        results = await bot.shard.broadcastEval(`
          const appDir = require('path').dirname(require.main.filename);
          const storage = require(appDir + '/util/storage.js');
          const log = require(appDir + '/util/logger.js');
          const currentGuilds = storage.currentGuilds;
          const dbOps = require(appDir + '/util/dbOps.js');

          const links = JSON.parse('${JSON.stringify(links)}');
          const affectedGuilds = JSON.parse('${JSON.stringify(affectedGuilds)}');
          let removedLinks = [];

          for (var i in affectedGuilds) {
            const guildRss = currentGuilds.get(affectedGuilds[i]);
            if (!guildRss) continue;
            const rssList = guildRss.sources;
            let names = [];

            for (var name in rssList) {
              for (var e in links) {
                if (rssList[name].link === links[e]) {
                  removedLinks.push(links[e]);
                  names.push(name);
                }
              }
            }

            for (var l in names) {
              const channel = this.channels.get(rssList[names[l]].channel);
              if (${reason ? '"' + reason + '"' : undefined} && channel) channel.send('**ATTENTION** - Feeds with link <' + rssList[names[l]].link + '> have been forcibly removed from all servers. Reason: ${'"' + reason + '"'}').catch(err => log.controller.warning('Could not send force removal notification to server', channel, err))
              dbOps.guildRss.removeFeed(guildRss, names[l], err => {
                if (err) log.controller.info('for forceremove error', err)
              });
            }
          }

          removedLinks;
        `)
        let removed = []
        let total = 0

        // Send the final message
        let msg = '```'
        for (var a in results) {
          const removedLinks = results[a]
          if (!removedLinks) continue
          removed = removed.concat(removedLinks)
          total += removedLinks.length
        }
        for (var b in removed) msg += '\n' + removed[b]

        await message.channel.send(`Removed \`${total}\` source(s). Links:\n${msg + '```'}`)
        log.controller.info(`The following links have been forcibly removed: \n${removed}`, message.author)
      } catch (err) {
        log.controller.info('forceremove 2', err)
      }
    })

    collector.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => log.controller.warning(`Unable to send expired menu message`, err))
      else if (reason !== 'user') return message.channel.send(reason)
    })
  } catch (err) {
    log.controller.warning('forceremove', err)
  }
}
