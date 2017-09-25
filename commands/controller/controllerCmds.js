const config = require('../../config.json')
const Discord = require('discord.js')
const moment = require('moment-timezone')
const storage = require('../../util/storage.js')
const blacklistGuilds = storage.blacklistGuilds
const currentGuilds = storage.currentGuilds
const cookieAccessors = storage.cookieAccessors
const overriddenGuilds = storage.overriddenGuilds
const failedLinks = storage.failedLinks
const debugFeeds = require('../../util/debugFeeds.js').list
const fs = require('fs')
const fileOps = require('../../util/fileOps.js')
const requestStream = require('../../rss/request.js')
const channelTracker = require('../../util/channelTracker.js')
const removeRss = require('../../util/removeRss.js')

function isNumber (configName, string) {
  const input = parseInt(string.split(' ')[2].trim(), 10)
  if (isNaN(input) || input < 0 || input % 1 !== 0) return 'That is not a valid number.'
  if (configName === 'menuColor' && input > 16777215) return '`menuColor` cannot be higher than 16777215.'
  return true
}

function isBool (configName, string) {
  const input = string.split(' ')[2].trim()
  if (input !== 'true' && input !== 'false') return 'That is not a valid boolean, must be either true or false.'
  return true
}

function isValidTimezone (configName, string) {
  const input = string.split(' ')[2].trim()
  if (!moment.tz.zone(input)) return 'That is not a valid timezone.'
  return true
}

function checkControllerIds (configName, string) {
  const input = string.split(' ')
  if (input.length !== 4 || (input[2] !== 'add' && input[2] !== 'remove')) return `Incorrect usage. Proper syntax is \`${config.botSettings.prefix}setconfig controllerids <add/remove> <id>\`.`
  if (isNaN(input[3])) return 'That is an invalid ID - not an integer.'
  return true
}

const validConfig = {
  'LOGGING': {
    showLinkErrs: {
      type: 'boolean',
      desc: 'Log connection failures on requests to feed URLs. Default is `true`.',
      checkValid: isBool
    },
    showUnfiltered: {
      type: 'boolean',
      desc: 'Log article links/titles that weren\'t sent due to failing to pass specified filters. Default is `true`.',
      checkValid: isBool
    }
  },
  'BOT SETTINGS': {
    prefix: {
      type: 'string',
      desc: 'Prefix for Discord commands.'
    },
    menuColor: {
      type: 'number',
      desc: 'The color of the Discord embed menu commands, between 0 and 16777215. Must be an integer color. Default is `7833753`.',
      checkValid: isNumber
    },
    controllerIds: {
      type: 'array',
      desc: 'User IDs who have access to Bot Controller commands. Two arguments, `<add/remove> <id>`.',
      checkValid: checkControllerIds
    }
  },
  'FEED SETTINGS': {
    timezone: {
      type: 'string',
      desc: 'Only useful if {date} placeholder is used. By default the date will be in UTC if left blank. Must be from <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> under TZ column.',
      checkValid: isValidTimezone
    },
    timeFormat: {
      type: 'string',
      desc: 'Format how {date} is shown. See details at <http://momentjs.com/docs/#/displaying/format/>. Whatever is here, will be inside `.format(<timeFormat>)` Default is `ddd, D MMMM YYYY, h:mm A z`.'
    },
    maxFeeds: {
      type: 'number',
      desc: 'The maximum amount of feeds each server is allowed to have. Default is `0` (unlimited).',
      checkValid: isNumber
    },
    defaultMaxAge: {
      type: 'number',
      desc: 'The max aged feed in days that the bot will send to Discord on startup if `sendOldMessages` is `true`. Default is `1`.',
      checkValid: isNumber
    },
    cycleMaxAge: {
      type: 'number',
      desc: 'The max aged feed in days that the bot will send to Discord during a cycle. Default is `1`.'
    },
    defaultMessage: {
      type: 'string',
      desc: 'If no custom message is defined for a specific feed, this will be the message the feed will fallback to.'
    }
  },
  'ADVANCED': {
    batchSize: {
      type: 'number',
      desc: 'Number of requests that must finish before proceeding to the next batch per retrieval cycle. Defaults is `400`.',
      checkValid: isNumber
    }
  }
}

function printConfigHelp () {
  const message = new Discord.RichEmbed()
  .setTitle('List of Confirgurable Configs')
  .setColor(config.botSettings.menuColor)
  .setDescription(`The syntax to change certain configs through is \`${config.botSettings.prefix}setconfig <config> <argument(s)>\`\n\u200b`)

  for (var category in validConfig) {
    let description = ''
    for (var configName in validConfig[category]) {
      description += `\n\n**${configName}** (${validConfig[category][configName].type})\n*${validConfig[category][configName].desc}*`
    }
    message.addField(category, description, true)
  }

  return message
}

exports.stats = function (bot, message) {
  message.channel.send(`Guilds: ${bot.guilds.size}\nUsers: ${bot.users.size}\nChannels: ${bot.channels.size}`).catch(err => console.log('Commands Info: Could not send stats, reason:\n', err))
}

exports.setgame = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  let game = content.join(' ')
  if (game === 'null') game = null
  // bot.user.setGame(game)
  bot.user.setPresence({ game: { name: game, type: 0 } })
  config.botSettings.defaultGame = game // Make sure the change is saved even after a login retry
}

exports.setavatar = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  bot.user.setAvatar(content[0]).catch(err => console.log(`Bot Controller: Unable to set avatar. (${err})`))
}

exports.setusername = function (bot, message) { // Heavily rate limited at 2 requests per hour, use sparingly
  const content = message.content.split(' ')
  if (content.length === 1) return
  content.shift()
  let username = content.join(' ')
  bot.user.setUsername(username).catch(err => console.log(`Bot Controller: Unable to set username. (${err})`))
}

exports.pingme = function (bot, message) {
  const pong = new Discord.RichEmbed()
  .setTitle('Sending')
  .setDescription('pong!')

  message.channel.send({embed: pong}).catch(err => console.info(`Commands Warning: Could not send the pong embed (${err})\n`, pong))
}

exports.blacklist = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const guild = bot.guilds.get(content[1])
  if (!guild) return message.channel.send('No such guild exists.')
  if (blacklistGuilds.ids.includes(content[1])) return message.channel.send(`Guild ${guild.id} (${guild.name}) is already blacklisted.`)

  blacklistGuilds.ids.push(guild.id)

  fs.writeFile('./settings/blacklist.json', JSON.stringify(blacklistGuilds, null, 2), function (err) {
    if (err) {
      console.log(`Bot Controller: Unable to permanently blacklist (${guild.id} ${guild.name}) as requested by (${message.author.id}, ${message.author.username}), reason: `, err)
      return message.channel.send(`Unable to permanently blacklist. Reason: `, err)
    }
    try {
      fs.unlinkSync(`./sources/${guild.id}.json`)
      const guildRss = currentGuilds.get(content[1])
      if (guildRss) {
        for (var rssName in guildRss.sources) {
          removeRss(guild.id, rssName, function (link, rssName) {
            console.log(`Bot Controller: Removed ${rssName} has part of blacklist operation.`)
          })
        }
        currentGuilds.delete(guild.id)
      }
      console.log(`Bot Controller: Successfully blacklisted guild (${guild.id} ${guild.name}) and deleted source file as requested by (${message.author.id}, ${message.author.username}).`)
      message.channel.send(`Successfully blacklisted guild ${guild.id} (${guild.name}) and deleted source file.`)
    } catch (e) {
      console.log(`Bot Controller: Successfully blacklisted, but unable to delete source file for guild (${guild.id} ${guild.name}) as requested by (${message.author.id}, ${message.author.username}). Reason: `, e)
    }
  })
}

exports.unblacklist = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  if (!blacklistGuilds.ids.includes(content[1])) return message.channel.send(`No such blacklisted guild.`)

  for (var x in blacklistGuilds.ids) {
    if (blacklistGuilds.ids[x] === content[1]) {
      blacklistGuilds.ids.splice(x, 1)
      fs.writeFile('./settings/blacklist.json', JSON.stringify(blacklistGuilds, null, 2), function (err) {
        if (err) throw err
        console.log(`Guild \`${content[1]}\` ${bot.guilds.get(content[1]) ? '(' + bot.guilds.get(content[1]).name + ') ' : ''}has been unblacklisted by (${message.author.id}, ${message.author.username}).`)
        message.channel.send(`Guild \`${content[1]}\` ${bot.guilds.get(content[1]) ? '(' + bot.guilds.get(content[1]).name + ') ' : ''}successfully unblacklisted.`)
      })
      break
    }
  }
}

exports.refresh = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const failLimit = (config.feedSettings.failLimit && !isNaN(parseInt(config.feedSettings.failLimit, 10))) ? parseInt(config.feedSettings.failLimit, 10) : 0

  if (failLimit === 0) return message.channel.send(`No fail limit has been set.`)
  if (failedLinks.size() === 0) return message.channel.send(`There are no feeds that have exceeded the fail limit.`)
  let found = false

  currentGuilds.forEach(function (guildRss, guildId) {
    const rssList = guildRss.sources
    for (var rssName in rssList) {
      if (rssList[rssName].link === content[1]) { // Arbitrarily choose a source from the link
        found = true
        const source = rssList[rssName]

        requestStream(source.link, null, null, function (err) {
          if (err) {
            console.log(`Bot Controller: Unable to refresh feed link ${source.link} by (${message.author.id}, ${message.author.username}), reason: `, err)
            return message.channel.send(`Unable to refresh feed. Reason:\n\`\`\`${err}\n\`\`\``)
          }
          delete failedLinks[source.link]
          try { fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2)) } catch (e) { console.log(`Bot Controller: Unable to update failedLinks.json from refresh (${e})`) }
          console.log(`Bot Controller: Link ${source.link} has been refreshed by (${message.author.id}, ${message.author.username}), and will be back on cycle.`)
          message.channel.send(`Successfully refreshed <${source.link}>.`)
        })
        break
      }
    }
  })

  if (!found) message.channel.send(`Unable to find source with this link.`)
}

exports.getsources = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return
  const sources = (currentGuilds.get(content[1]) && currentGuilds.get(content[1]).sources) ? currentGuilds.get(content[1]).sources : undefined

  const msg = sources ? `\`\`\`js\n${JSON.stringify(currentGuilds.get(content[1]).sources, null, 2)}\n\`\`\`` : ''

  if (msg.length < 2000) message.channel.send(`\`\`\`js\n${JSON.stringify(sources, null, 2)}\n\`\`\``)
  else if (msg.length >= 2000) {
    message.channel.send('Unable to send due to character length exceeding 2000. Logging to console instead.')
    console.info(`Bot Controller: Sources of guild ID ${content[1]} requested by (${message.author.id}, ${message.author.username}):\n`, sources)
  } else message.channel.send('No sources available.')
}

exports.feedguild = function (bot, message) { // Get guild ID from rssName
  const content = message.content.split(' ')
  if (content.length !== 2) return
  let found = false

  currentGuilds.forEach(function (guildRss, guildId) {
    let rssList = guildRss.sources
    for (var rssName in rssList) {
      if (rssName === content[1]) {
        found = true
        return message.channel.send(`Found guild ID: ${guildId}`)
      }
    }
  })

  if (!found) message.channel.send(`Could not find any feeds with that rssName.`)
}

exports.cleanfailed = function (bot, message) {
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
    return message.channel.send(cleaned ? `No links were eligible to be removed from guilds, but outdated links have been deleted from failedLinks.json.` : `No links are eligible to be cleaned out from failedLinks.json.`).catch(err => console.log(`Promise Warning: forceremove 1: ${err}`))
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
          let channel = bot.channels.get(rssList[rssName].channel)
          if (reason && channel) channel.send(`**ATTENTION:** Feeds with link <${link}> have been forcibly removed from all servers. Reason: ${reason}`).catch(err => console.log(`Could not send force removal notification to server ${channel.guild.id}, reason: ${err}`))
          removeRss(channel.guild.id, rssName)
          delete failedLinks[link]
          delete rssList[rssName]
        }
        fileOps.updateFile(affectedGuilds[i], guildRss)
      }

      if (removedLinks.length === 0) message.channel.send('Unable to remove any links.').catch(err => console.log(`Promise Warning: forceremove 2: ${err}`))

      msg = '```'
      for (var p in removedLinks) {
        msg += `\n${removedLinks[p]}`
      }

      message.channel.send(`Successfully removed \`${removedLinks.length}\` source(s). ${msg.length > 1950 ? '' : 'Links:```\n' + removedLinks + '```'}`)
      console.log(`Bot Controller: The following links have been forcibly removed by (${message.author.id}, ${message.author.username}): \n`, removedLinks)

      if (!bot.shard) {
        for (var j in failedLinks) {
          if (typeof failedLinks[j] === 'string' || failedLinks[j] === 100) delete failedLinks[j]
        }
      }

      fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2))
    })

    collector.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
      else if (reason !== 'user') return message.channel.send(reason)
    })
  }).catch(err => console.log(`Could not send a list of links that are to be afffected, reason: `, err))
}

exports.forceremove = function (bot, message) {
  let content = message.content.split(' ')
  if (content.length < 2) return message.channel.send(`The correct syntax is \`${config.botSettings.prefix}forceremove <keywords> <optional reason>\`.`)
  content.shift()
  let linkPart = content.shift()
  let reason = content.length > 0 ? content.join(' ').trim() : undefined

  const affectedGuilds = []
  const links = []

  currentGuilds.forEach(function (guildRss, guildId) {
    let rssList = guildRss.sources

    for (var rssName in rssList) {
      if (rssList[rssName].link.includes(linkPart)) {
        if (!links.includes(rssList[rssName].link)) links.push(rssList[rssName].link)
        if (!affectedGuilds.includes(guildId)) affectedGuilds.push(guildId)
      }
    }
  })

  if (links.length === 0) return message.channel.send(`No such links of your criteria have been found.`).catch(err => console.log(`Promise Warning: forceremove 1: ${err}`))

  let msg = '```'
  for (var x in links) {
    msg += `\n${links[x]}`
  }
  msg += '```'

  const collector = message.channel.createMessageCollector(m => m.author.id === message.author.id, {time: 240000})
  channelTracker.add(message.channel.id)

  message.channel.send(`The list of links to be removed ${reason ? 'and the reason for removal ' : ''}is shown below.\n\n${reason ? '```Reason: ' + reason + '```\n' : ''}${msg.length > 1950 ? '```Unable to print links to discord - exceeds 1950 chars. Please see console.```' : msg}\n\nDo you want to continue? Type **Yes** to confirm, or **No** to cancel.`)
  .then(function (prompt) {
    if (msg.length > 1950) {
      console.log(`Bot Controller: Links that are about to be forcibly removed as requested by (${message.author.id}, ${message.author.username}): `)
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
          let channel = bot.channels.get(rssList[names[l]].channel)
          if (reason && channel) channel.send(`**ATTENTION:** Feeds with link <${rssList[names[l]].link}> have been forcibly removed from all servers. Reason: ${reason}`).catch(err => console.log(`Could not send force removal notification to server ${channel.guild.id}, reason: ${err}`))
          removeRss(channel.guild.id, names[l])
          delete rssList[names[l]]
        }
        fileOps.updateFile(affectedGuilds[i], guildRss)
      }

      if (removedLinks.length === 0) message.channel.send('Unable to remove any links.').catch(err => console.log(`Promise Warning: forceremove 2: ${err}`))

      msg = '```'
      for (var p in removedLinks) {
        msg += `\n${removedLinks[p]}`
      }

      message.channel.send(`Successfully removed \`${removedLinks.length}\` source(s). Links:\n${msg + '```'}`)
      console.log(`Bot Controller: The following links have been forcibly removed by (${message.author.id}, ${message.author.username}): \n`, removedLinks)
    })

    collector.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
      else if (reason !== 'user') return message.channel.send(reason)
    })
  }).catch(err => console.log(`Could not send a list of links that are to be afffected, reason: `, err))
}

exports.debug = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const rssName = content[1]

  let found = false
  currentGuilds.forEach(function (guildRss, guildId) {
    const rssList = guildRss.sources
    for (var name in rssList) {
      if (rssName === name) {
        found = true
        debugFeeds.push(rssName)
        console.log(`Added ${rssName} to debugging list.`)
      }
    }
  })
  if (!found) console.log(`Unable to add ${rssName} to debugging list, not found in any guild sources.`)
}

exports.undebug = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return

  const rssName = content[1]

  if (!debugFeeds.includes(rssName)) return console.log(`Cannot remove, ${rssName} is not in debugging list.`)
  for (var index in debugFeeds) {
    if (debugFeeds[index] === rssName) {
      debugFeeds.splice(index, 1)
      return console.log(`Removed ${rssName} from debugging list.`)
    }
  }
}

exports.setoverride = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length < 3 || content.length > 4) return message.channel.send(`The proper syntax to override a server's feed limit is \`${config.botSettings.prefix}setoverride <guildID> <#>\`.`)
  if (!currentGuilds.has(content[1]) || !bot.guilds.has(content[1])) return message.channel.send(`Unable to set limit, guild ID \`${content[1]}\` was either not found in guild list or has no active feeds.`)

  let newLimit = parseInt(content[2], 10)

  if (isNaN(newLimit) || newLimit % 1 !== 0) return message.channel.send(`That is not a valid number.`)
  if (newLimit === config.feedSettings.maxFeeds) return message.channel.send(`That is already the default limit.`)

  overriddenGuilds[content[1]] = newLimit
  fs.writeFile('./settings/limitOverrides.json', JSON.stringify(overriddenGuilds, null, 2), function (err) {
    if (err) throw err
    var enforced

    if (content[3] === 'enforce') {
      enforced = 0
      let guildRss = currentGuilds.get(content[1])
      let rssList = guildRss.sources
      if (rssList.size() > newLimit) {
        for (var rssName in rssList) {
          if (rssList.size() > newLimit) {
            enforced++
            removeRss(content[1], rssName)
            delete rssList[rssName]
          }
        }
      }
      if (enforced && fs.existsSync(`./sources/${content[1]}.json`)) {
        fs.writeFile(`./sources/${content[1]}.json`, JSON.stringify(guildRss), function (err) {
          if (err) throw err
        })
      }
    }

    message.channel.send(`Override limit set to \`${content[2]}\` for guild ID \`${content[1]}\`.${enforced ? ' Limit has been enforced, `' + enforced + '` feed(s) have been removed.' : ''}`)
    console.log(`Bot Controller: Override limit set to \`${content[2]}\` for guild ID \`${content[1]}\` ${enforced ? ' (limit enforced, `' + enforced + '` feed(s) have been removed)' : ''} by (${message.author.id}, ${message.author.username}).`)
  })
}

exports.removeoverride = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length < 2 || content.length > 3) return message.channel.send(`The proper syntax to override a server's feed limit is \`${config.botSettings.prefix}removeoverride <guildID>\`.`)

  if (overriddenGuilds[content[1]]) {
    delete overriddenGuilds[content[1]]
    fs.writeFile('./settings/limitOverrides.json', JSON.stringify(overriddenGuilds, null, 2), function (err) {
      if (err) throw err
      var enforced

      if (content[2] === 'enforce') {
        enforced = 0
        const guildRss = currentGuilds.get(content[1])
        const rssList = guildRss.sources
        if (rssList.size() > config.feedSettings.maxFeeds) {
          for (var rssName in rssList) {
            if (rssList.size() > config.feedSettings.maxFeeds) {
              enforced++
              removeRss(content[1], rssName)
              delete rssList[rssName]
            }
          }
        }
        if (enforced && fs.existsSync(`./sources/${content[1]}.json`)) {
          fs.writeFile(`./sources/${content[1]}.json`, JSON.stringify(guildRss), function (err) {
            if (err) throw err
          })
        }
      }

      message.channel.send(`Override limit reset for guild ID \`${content[1]}\`.${enforced ? ' Limit has been enforced, `' + enforced + '` feeds have been removed.' : ''}`)
      console.log(`Bot Controller: Override limit reset for guild ID \`${content[1]}\`.${enforced ? ' Limit has been enforced, `' + enforced + '` feeds have been removed.' : ''} By (${message.author.id}, ${message.author.username})`)
    })
  } else return message.channel.send(`Unable to reset, there are no overrides set for that guild.`)
}

exports.allowcookies = function (bot, message) {
  if (!config.advanced || config.advanced.restrictCookies !== true) return message.channel.sendMessage('Cookie usage is allowed by default if `restrictCookies` is not set to `true`.')
  const content = message.content.split(' ')
  if (content.length !== 2) return message.channel.send(`The proper syntax to allow cookies for a user is \`${config.botSettings.prefix}allowcookies <userID>\`.`)
  if (!bot.users.get(content[1])) return message.channel(`Unable to allow cookies. User ID \`${content[1]}\` was not found in user list.`)
  if (cookieAccessors.ids.includes(content[1])) return message.channel.sendMessage(`User ID \`${content[1]}\` already has permission for cookie usage.`)

  cookieAccessors.ids.push(content[1])

  fs.writeFileSync('./settings/cookieAccessors.json', JSON.stringify(cookieAccessors, null, 2))

  message.channel.send(`Cookies are now allowed for user ID \`${content[1]}\` (${bot.users.get(content[1]).username}).`)
  console.log(`Bot Controller: Cookies have been allowed for user ID ${content[1]}, (${bot.users.get(content[1]).username}) by (${message.author.id}, ${message.author.username})`)
}

exports.disallowcookies = function (bot, message) {
  if (!config.advanced || config.advanced.restrictCookies !== true || !config.advanced.restrictCookies) return message.channel.send(`Cannot disallow cookies if config \`restrictCookies\` is not set to \`true\`/\`1\`.`)
  const content = message.content.split(' ')
  if (content.length !== 2) return message.channel.send(`The proper syntax to allow cookies for a user is \`${config.botSettings.prefix}disallowcookies <userID>\`.`)

  for (var index in cookieAccessors.ids) {
    if (cookieAccessors.ids[index] === content[1]) {
      cookieAccessors.ids.splice(index, 1)
      fs.writeFileSync('./settings/cookieAccessors.json', JSON.stringify(cookieAccessors, null, 2))
      message.channel.send(`User ID \`${content[1]}\` (${bot.users.get(content[1]) ? bot.users.get(content[1]).username : 'User not found in bot user list.'}) removed from cookie accessor list.`)
      return console.log(`Bot Controller: User ID \`(${content[1]}\`. (${bot.users.get(content[1]) ? bot.users.get(content[1]).username : 'User not found in bot user list.'}) removed from cookie accessor list by (${message.author.id}, ${message.author.username}).`)
    }
  }

  message.channel.send(`Cannot remove. User ID \`${content[1]}\` was not found in list of cookie accessors.`)
}

exports.test = function (bot, message) { // For random tests

}

exports.setconfig = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length === 1) return message.channel.send({embed: printConfigHelp()})
  if (content.length === 2) return message.channel.send(`The proper syntax to change certain configs through is ${config.botSettings.prefix}setconfig <config> <argument(s)>.`)
  for (var category in validConfig) {
    for (var configName in validConfig[category]) {
      if (content[1] === configName) {
        let configObject = validConfig[category][configName]
        if (configObject.checkValid && configObject.checkValid(configName, message.content) !== true) return message.channel.send(configObject.checkValid(configName, message.content))
        var setting

        switch (configObject.type) { // Set the actual setting
          case 'number':
            setting = parseInt(content[2], 10)
            break
          case 'boolean':
            setting = content[2] === 'true'
            break
          case 'array':
            setting = config.botSettings.controllerIds
            if (content[2] === 'add') setting.push(content[3])
            else if (content[2] === 'remove') {
              let found = false
              for (var index in setting) {
                if (setting[index] === content[3]) {
                  found = true
                  setting.splice(index, 1)
                }
              }
              if (!found) {
                setting = null
                message.channel.send('No such controller ID exists to be removed.')
              }
            }
            break

          case 'string':
            setting = content[2]
        }

        if (setting == null) return
        let categoryName = ''

        switch (category) { // Set the category to proper case according to config.json
          case 'ADVANCED':
          case 'LOGGING':
            categoryName = category.toLowerCase()
            break
          case 'FEED SETTINGS':
            categoryName = 'feedSettings'
            break
          case 'BOT SETTINGS':
            categoryName = 'botSettings'
        }

        if (!config[categoryName]) config[categoryName] = {}
        config[categoryName][configName] = setting

        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))
        console.log(`Bot Controller: Config '${configName}' value has been changed to to '${setting}' by (${message.author.id}, ${message.author.username}).`)
        delete require.cache[require.resolve('../../config.json')]
        return message.channel.send(`Config \`${configName}\` has been set to \`${setting}\`.`)
      }
    }
  }

  message.channel.send('No such config exists.')
}
