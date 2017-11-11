const fs = require('fs')
const storage = require('../../util/storage.js')
const removeRss = require('../../util/removeRss.js')
const channelTracker = require('../../util/channelTracker.js')
const fileOps = require('../../util/fileOps.js')

exports.normal = function (bot, message) {
  const currentGuilds = storage.currentGuilds

  const failedLinks = storage.failedLinks
  let content = message.content.split(' ')
  content.shift()
  const reason = content.join(' ').trim()

  const affectedGuilds = []
  const links = []

  currentGuilds.forEach(function (guildRss, guildId) {
    const rssList = guildRss.sources

    for (var failedLink in failedLinks) {
      if (typeof failedLinks[failedLink] !== 'string' || failedLinks[failedLink] < 100) continue
      for (var rssName in rssList) {
        if (rssList[rssName].link === failedLink) {
          if (!links.includes(rssList[rssName].link)) links.push(rssList[rssName].link)
          if (!affectedGuilds.includes(guildId)) affectedGuilds.push(guildId)
        }
      }
    }
  })

  if (links.length === 0) {
    let cleaned = false
    if (!bot.shard) {
      for (var j in failedLinks) {
        if (typeof failedLinks[j] === 'string' || failedLinks[j] >= 100) {
          cleaned = true
          delete failedLinks[j]
        }
      }
    }

    fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2))
    return message.channel.send(cleaned ? `No links were eligible to be removed from guilds, but outdated links have been deleted from failedLinks.json.` : `No links are eligible to be cleaned out from failedLinks.json.`).catch(err => console.log(`Promise Warning: forceremove 1.`, err.message || err))
  }

  let msg = '```'
  for (var x in links) {
    msg += `\n${links[x]}`
  }
  msg += '```'

  const collector = message.channel.createMessageCollector(m => m.author.id === message.author.id, {time: 240000})
  channelTracker.add(message.channel.id)

  message.channel.send(`The list of links (${links.length}) to be cleaned out from failedLinks.json ${reason ? 'and the reason for removal ' : ''}is shown below.\n\n${reason ? '```Reason: ' + reason + '```\n' : ''}${msg.length > 1950 ? '```Unable to print links to discord - exceeds 1950 chars. Please see console.```' : msg}\n\nDo you want to continue? Type **Yes** to confirm, or **No** to cancel.`)
  .then(function (prompt) {
    if (msg.length > 1950) {
      console.log(`Bot Controller: Links that are about to be forcibly removed for cleanup as requested by (${message.author.id}, ${message.author.username}): `)
      for (var a in links) {
        console.info(`\n${links[a]}`)
      }
    }

    collector.on('collect', function (m) {
      if (m.content !== 'Yes' && m.content !== 'No') return message.channel.send('That is not a valid Option. Please type either **Yes** or **No**.')
      collector.stop()

      if (m.content === 'No') return message.channel.send(`Force removal canceled.`)
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
          if (reason && channel) channel.send(`**ATTENTION:** Feeds with link <${link}> have been forcibly removed from all servers. Reason: ${reason}`).catch(err => console.log(`Could not send force removal notification to server ${channel.guild.id}. `, err.message || err))
          removeRss(channel.guild.id, rssName)
          delete failedLinks[link]
          delete rssList[rssName]
        }
        fileOps.updateFile(affectedGuilds[i], guildRss)
      }

      if (removedLinks.length === 0) return message.channel.send('Unable to remove any links.').catch(err => console.log(`Promise Warning: forceremove 2. `, err.message || err))

      msg = '```'
      for (var p in removedLinks) {
        msg += `\n${removedLinks[p]}`
      }

      message.channel.send(`Successfully removed \`${removedLinks.length}\` source(s) from guilds. ${msg.length > 1950 ? '' : 'Links:```\n' + removedLinks + '```'}`)
      console.log(`Bot Controller: The following links have been forcibly removed by (${message.author.id}, ${message.author.username}): \n`, removedLinks)

      for (var j in failedLinks) {
        if (typeof failedLinks[j] === 'string' || failedLinks[j] === 100) delete failedLinks[j]
      }

      try { fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2)) } catch (e) { console.log(`Bot Controller: Unable to write to failedLinks.json after cleanfailed. `, e.message || e) }
    })

    collector.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message.`, err.message || err))
      else if (reason !== 'user') return message.channel.send(reason)
    })
  }).catch(err => console.log(`Bot Controller: Could not send a list of links that are to be affected. `, err.message || err))
}

exports.sharded = function (bot, message, Manager) {
  const failedLinks = storage.failedLinks
  let content = message.content.split(' ')
  content.shift()
  const reason = content.join(' ').trim()

  const affectedGuilds = []
  const links = []
  bot.shard.broadcastEval(`
    const appDir = require('path').dirname(require.main.filename);
    const storage = require(appDir + '/util/storage.js');
    const currentGuilds = storage.currentGuilds;
    const failedLinks = storage.failedLinks;

    const obj = {affectedGuilds: [], links: []};
    const affectedGuilds = obj.affectedGuilds;
    const links = obj.links;

    currentGuilds.forEach(function (guildRss, guildId) {
      const rssList = guildRss.sources

      for (var failedLink in failedLinks) {
        if (typeof failedLinks[failedLink] !== 'string' || failedLinks[failedLink] < 100) continue
        for (var rssName in rssList) {
          if (rssList[rssName].link === failedLink) {
            if (!links.includes(rssList[rssName].link)) links.push(rssList[rssName].link);
            if (!affectedGuilds.includes(guildId)) affectedGuilds.push(guildId);
          }
        }
      }
    })

    obj;
  `).then(results => {
    for (var x in results) {
      const shardLinks = results[x].links
      const shardAffectedGuilds = results[x].affectedGuilds
      for (var a in shardLinks) if (!links.includes(shardLinks[a])) links.push(shardLinks[a])
      for (var b in shardAffectedGuilds) if (!affectedGuilds.includes(shardAffectedGuilds[b])) affectedGuilds.push(shardAffectedGuilds[b])
    }

    if (links.length === 0) {
      let cleaned = false

      for (var j in failedLinks) {
        if (typeof failedLinks[j] === 'string' || failedLinks[j] >= 100) {
          cleaned = true
          delete failedLinks[j]
        }
      }

      if (!cleaned) return message.channel.send(`No links are eligible to be cleaned out from failedLinks.json.`)

      try { fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2)) } catch (e) { console.log(`Bot Controller: Unable to write to failedLinks after eval cleanfailed resulting in 0 eligible links. `, e.message || e) }

      return bot.shard.broadcastEval(`
        require(require('path').dirname(require.main.filename) + '/util/storage.js').failedLinks = JSON.parse('${JSON.stringify(failedLinks)}');
      `).then(() => {
        return message.channel.send(`No links were eligible to be removed from guilds, but outdated links have been deleted from failedLinks.json.`).catch(err => console.log(`Promise Warning: forceremove 1.`, err.message || err))
      }).catch(err => {
        console.log(`Bot Controller: Unable to broadcast failedLinks unification after eval cleanfailed resulting in 0 eligible links. `, err.message || err)
        message.channel.send(`Unable to broadcast failedLinks unification after eval cleanfailed resulting in 0 eligible links. `, err.message || err)
      })
    }

    let msg = '```'
    for (var u in links) msg += `\n${links[u]}`
    msg += '```'

    const collector = message.channel.createMessageCollector(m => m.author.id === message.author.id, {time: 240000})
    channelTracker.add(message.channel.id)

    message.channel.send(`The list of links (${links.length}) to be cleaned out from failedLinks.json ${reason ? 'and the reason for removal ' : ''}is shown below.\n\n${reason ? '```Reason: ' + reason + '```\n' : ''}${msg.length > 1950 ? '```Unable to print links to discord - exceeds 1950 chars. Please see console.```' : msg}\n\nDo you want to continue? Type **Yes** to confirm, or **No** to cancel.`)
    .then(function (prompt) {
      if (msg.length > 1950) {
        console.log(`Bot Controller: Links that are about to be forcibly removed for cleanup as requested by (${message.author.id}, ${message.author.username}): `)
        for (var a in links) {
          console.info(`\n${links[a]}`)
        }
      }

      collector.on('collect', function (m) {
        if (m.content !== 'Yes' && m.content !== 'No') return message.channel.send('That is not a valid Option. Please type either **Yes** or **No**.')
        collector.stop()

        if (m.content === 'No') return message.channel.send(`Force removal canceled.`)

        bot.shard.broadcastEval(`
          const appDir = require('path').dirname(require.main.filename);
          const storage = require(appDir + '/util/storage.js');
          const currentGuilds = storage.currentGuilds;
          const failedLinks = storage.failedLinks;
          const removeRss = require(appDir + '/util/removeRss.js');
          const fileOps = require(appDir + '/util/fileOps.js');
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
              if (${reason ? '"' + reason + '"' : undefined} && channel) channel.send('**ATTENTION:** Feeds with link <' + link + '> have been forcibly removed from all servers. Reason: ${reason ? '"' + reason + '"' : undefined}').catch(err => console.log('Could not send force removal notification to server ' + channel.guild.id + '. ', err.message || err))
              removeRss(channel.guild.id, rssName);
              delete failedLinks[link];
              delete rssList[rssName];
            }
            fileOps.updateFile(affectedGuilds[i], guildRss);
          }

          removedLinks;
        `).then(results => {
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
            delete failedLinks[link]
          }

          if (removed.length === 0) return message.channel.send('Unable to remove any links.').catch(err => console.log(`Promise Warning: forceremove 2s. `, err.message || err))

          for (var j in failedLinks) {
            if (typeof failedLinks[j] === 'string' || failedLinks[j] === 100) delete failedLinks[j]
          }

          bot.shard.broadcastEval(`
            require(require('path').dirname(require.main.filename) + '/util/storage.js').failedLinks = JSON.parse('${JSON.stringify(failedLinks)}');
          `).then(() => {
            message.channel.send(`Successfully removed \`${total}\` source(s) from guilds. ${msg.length > 1950 ? '' : 'Links:```\n' + removed + '```'}`)
            console.log(`Bot Controller: The following links have been forcibly removed by (${message.author.id}, ${message.author.username}): \n`, removed)

            try { fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2)) } catch (e) { console.log(`Bot Controller: Unable to write to failedLinks.json after cleanfailed. `, e.message || e) }
          }).catch(err => console.log(`Bot Controller: Unable to broadcast failedLinks cache update after successful eval cleanfailed and removal action. `, err.message || err))
        }).catch(err => console.log(`Bot Controller: Unable to broadcast removal actions after successful eval cleanfailed. `, err.message || err))
      })

      collector.on('end', function (collected, reason) {
        channelTracker.remove(message.channel.id)
        if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message.`, err.message || err))
        else if (reason !== 'user') return message.channel.send(reason)
      })
    })
  }).catch(err => console.log(`Bot Controller: Unable to broadcast eval cleanfailed. `, err.message || err))
}
