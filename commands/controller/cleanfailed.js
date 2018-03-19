const storage = require('../../util/storage.js')
const config = require('../../config.json')
const channelTracker = require('../../util/channelTracker.js')
const dbOps = require('../../util/dbOps.js')
const log = require('../../util/logger.js')

exports.normal = async (bot, message) => {
  const currentGuilds = storage.currentGuilds

  const failedLinks = storage.failedLinks
  let content = message.content.split(' ')
  content.shift()
  const reason = content.join(' ').trim()

  const affectedGuilds = []
  const links = []

  currentGuilds.forEach((guildRss, guildId) => {
    const rssList = guildRss.sources

    for (var failedLink in failedLinks) {
      if (typeof failedLinks[failedLink] !== 'string' || (config.feeds.failLimit > 0 && failedLinks[failedLink] < config.feeds.failLimit)) continue
      for (var rssName in rssList) {
        if (rssList[rssName].link === failedLink) {
          if (!links.includes(rssList[rssName].link)) links.push(rssList[rssName].link)
          if (!affectedGuilds.includes(guildId)) affectedGuilds.push(guildId)
        }
      }
    }
  })
  try {
    if (links.length === 0) {
      let cleaned = false
      if (!bot.shard) {
        for (var j in failedLinks) {
          if (typeof failedLinks[j] === 'string' || (config.feeds.failLimit > 0 && failedLinks[j] >= config.feeds.failLimit)) {
            cleaned = true
            dbOps.failedLinks.reset(j)
          }
        }
      }
      return message.channel.send(cleaned ? `No links were eligible to be removed from guilds, but outdated links have been deleted from failedLinks.` : `No links are eligible to be cleaned out from failedLinks.`).catch(err => log.controller.warning(`forceremove 1`, message.guild, err))
    }

    let msg = '```'
    for (var x in links) msg += `\n${links[x]}`
    msg += '```'

    const collector = message.channel.createMessageCollector(m => m.author.id === message.author.id, {time: 240000})
    channelTracker.add(message.channel.id)

    await message.channel.send(`The list of links (${links.length}) to be cleaned out from failedLinks ${reason ? 'and the reason for removal ' : ''}is shown below.\n\n${reason ? '```Reason: ' + reason + '```\n' : ''}${msg.length > 1950 ? '```Unable to print links to discord - exceeds 1950 chars. Please see console.```' : msg}\n\nDo you want to continue? Type **Yes** to confirm, or **No** to cancel.`)
    if (msg.length > 1950) {
      log.controller.info(`Links that are about to be forcibly removed for cleanup`, message.author)
      for (var a in links) {
        console.log(`\n${links[a]}`)
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
            const rssName = names[l]
            const link = rssList[rssName].link
            const channel = bot.channels.get(rssList[rssName].channel)
            if (reason && channel) channel.send(`**ATTENTION** - Feeds with link <${link}> have been forcibly removed from all servers. Reason: ${reason}`)
            dbOps.guildRss.removeFeed(guildRss, rssName)
          }
        }

        if (removedLinks.length === 0) return await message.channel.send('Unable to remove any links.')

        msg = '```'
        for (var p in removedLinks) {
          msg += `\n${removedLinks[p]}`
        }

        await message.channel.send(`Successfully removed \`${removedLinks.length}\` source(s) from guilds. ${msg.length > 1950 ? '' : 'Links:```\n' + removedLinks + '```'}`)
        log.controller.info(`The following links have been forcibly removed: \n${removedLinks}`, message.author)
      } catch (err) {
        log.controller.warning('cleanfailed 2', err)
      }
    })

    collector.on('end', (collected, reason) => {
      channelTracker.remove(message.channel.id)
      if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => log.controller.warning(`Unable to send expired menu message`, message.guild, err))
      else if (reason !== 'user') return message.channel.send(reason).catch(err => log.controller.warning('cleanfailed 3', message.guild, err))
    })
  } catch (err) {
    log.controller.warning('cleanfailed', message.guild, err)
  }
}

exports.sharded = async (bot, message, Manager) => {
  const failedLinks = storage.failedLinks
  let content = message.content.split(' ')
  content.shift()
  const reason = content.join(' ').trim()

  const affectedGuilds = []
  const links = []
  try {
    let results = await bot.shard.broadcastEval(`
      const appDir = require('path').dirname(require.main.filename);
      const storage = require(appDir + '/util/storage.js');
      const config = require(appDir + '/config.json');
      const currentGuilds = storage.currentGuilds;
      const failedLinks = storage.failedLinks;

      const obj = {affectedGuilds: [], links: []};
      const affectedGuilds = obj.affectedGuilds;
      const links = obj.links;

      currentGuilds.forEach(function (guildRss, guildId) {
        const rssList = guildRss.sources

        for (var failedLink in failedLinks) {
          if (typeof failedLinks[failedLink] !== 'string' || (config.feeds.failLimit > 0 && failedLinks[failedLink] < config.feeds.failLimit)) continue
          for (var rssName in rssList) {
            if (rssList[rssName].link === failedLink) {
              if (!links.includes(rssList[rssName].link)) links.push(rssList[rssName].link);
              if (!affectedGuilds.includes(guildId)) affectedGuilds.push(guildId);
            }
          }
        }
      })

      obj;
    `)
    for (var x in results) {
      const shardLinks = results[x].links
      const shardAffectedGuilds = results[x].affectedGuilds
      for (var a in shardLinks) if (!links.includes(shardLinks[a])) links.push(shardLinks[a])
      for (var b in shardAffectedGuilds) if (!affectedGuilds.includes(shardAffectedGuilds[b])) affectedGuilds.push(shardAffectedGuilds[b])
    }

    if (links.length === 0) {
      let cleaned = false

      for (var j in failedLinks) {
        if (typeof failedLinks[j] === 'string' || (config.feeds.failLimit > 0 && failedLinks[j] >= config.feeds.failLimit)) {
          cleaned = true
          dbOps.failedLinks.reset(j)
        }
      }

      if (!cleaned) return await message.channel.send(`No links are eligible to be cleaned out from failedLinks.`)
      return await message.channel.send(`No links were eligible to be removed from guilds, but outdated links have been deleted from failedLinks.`).catch(err => log.controller.warning(`forceremove 1.`, message.guild, err))
    }

    let msg = '```'
    for (var u in links) msg += `\n${links[u]}`
    msg += '```'

    const collector = message.channel.createMessageCollector(m => m.author.id === message.author.id, {time: 240000})
    channelTracker.add(message.channel.id)

    await message.channel.send(`The list of links (${links.length}) to be cleaned out from failedLinks ${reason ? 'and the reason for removal ' : ''}is shown below.\n\n${reason ? '```Reason: ' + reason + '```\n' : ''}${msg.length > 1950 ? '```Unable to print links to discord - exceeds 1950 chars. Please see console.```' : msg}\n\nDo you want to continue? Type **Yes** to confirm, or **No** to cancel.`)
    if (msg.length > 1950) {
      log.controller.info(`Links that are about to be forcibly removed for cleanup: `, message.author)
      for (var g in links) console.info(`\n${links[g]}`)
    }

    collector.on('collect', async m => {
      try {
        if (m.content !== 'Yes' && m.content !== 'No') return await message.channel.send('That is not a valid Option. Please type either **Yes** or **No**.')
        collector.stop()

        if (m.content === 'No') return await message.channel.send(`Force removal canceled.`)

        const results = await bot.shard.broadcastEval(`
          const appDir = require('path').dirname(require.main.filename);
          const storage = require(appDir + '/util/storage.js');
          const currentGuilds = storage.currentGuilds;
          const log = require(appDir + '/util/logger.js');
          const dbOps = require(appDir + '/util/dbOps.js');
          const removedLinks = [];
          const affectedGuilds = JSON.parse('${JSON.stringify(affectedGuilds)}');
          const links = JSON.parse('${JSON.stringify(links)}')

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
              const rssName = names[l];
              const link = rssList[rssName].link;
              const channel = this.channels.get(rssList[rssName].channel);
              if (${reason ? '"' + reason + '"' : undefined} && channel) channel.send('**ATTENTION** - Feeds with link <' + link + '> have been forcibly removed from all servers. Reason: ${reason ? '"' + reason + '"' : undefined}').catch(err => log.controller.warning('Could not send force removal notification to server', channel.guild, err))
              dbOps.guildRss.removeFeed(guildRss, rssName, err => {
                if (err) log.controller.warning('cleanfailed error', channel.guild, err)
              });
            }
          }

          removedLinks;
        `)
        let removed = []
        let msg = '```'
        let total = 0

        for (var a in results) {
          const removedLinks = results[a]
          if (!removedLinks) continue
          removed = removed.concat(removedLinks)
          total += removedLinks.length
        }
        for (var b in removed) {
          const link = removed[b]
          msg += '\n' + link
        }

        if (removed.length === 0) return await message.channel.send('Unable to remove any links.')

        log.controller.info(`The following links have been forcibly removed: \n${removed}`, message.author)
        await message.channel.send(`Successfully removed \`${total}\` source(s) from guilds. ${msg.length > 1950 ? '' : 'Links:```\n' + removed + '```'}`)
      } catch (err) {
        log.controller.warning('cleanfailed 2', message.guild, err)
      }
    })

    collector.on('end', (collected, reason) => {
      channelTracker.remove(message.channel.id)
      if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => log.controller.warning(`Unable to send expired menu message`, message.guild, err))
      else if (reason !== 'user') return message.channel.send(reason).catch(err => log.controller.warning('cleanfailed 3', message.guild, err))
    })
  } catch (err) {
    log.controller.warning('cleanfailed', message.guild, err)
  }
}
