const Discord = require('discord.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const filters = require('./util/filters.js')
const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Translator = require('../structs/Translator.js')
const VALID_OPTIONS = ['1', '2', '3', '4']

async function printSubscriptions (message, rssList, translate) {
  const guild = message.guild
  const subList = {}
  const msg = new Discord.RichEmbed()
    .setColor(config.bot.menuColor)
    .setDescription(translate('commands.rssmention.listSubscriptionsDescription'))
    .setAuthor(translate('commands.rssmention.subscriptionsList'))

  for (const rssName in rssList) {
    const source = rssList[rssName]
    const subscribers = source.subscribers
    if (!subscribers) continue
    for (const subscriber of subscribers) {
      const id = subscriber.id
      const type = subscriber.type
      if (!subList[source.title]) subList[source.title] = {}
      const embedReferenceTitle = !subscriber.filters || Object.keys(subscriber.filters).length === 0 ? 'globalSubs' : 'filteredSubs'
      if (!subList[source.title][embedReferenceTitle]) subList[source.title][embedReferenceTitle] = []
      if (type === 'user') {
        const resolvedUser = guild.members.get(id)
        const toInsert = resolvedUser ? `${resolvedUser.user.username}#${resolvedUser.user.discriminator}` : ''
        if (resolvedUser && !subList[source.title][embedReferenceTitle].includes(toInsert)) subList[source.title][embedReferenceTitle].push(toInsert)
      } else if (type === 'role') {
        const resolvedRole = guild.roles.get(id)
        const toInsert = resolvedRole ? resolvedRole.name : ''
        if (resolvedRole && !subList[source.title][embedReferenceTitle].includes(toInsert)) subList[source.title][embedReferenceTitle].push(toInsert)
      }
    }
  }

  if (Object.keys(subList).length === 0) {
    return message.channel.send(translate('commands.rssmention.listSubscriptionsNone'))
  }
  for (const feed in subList) {
    let list = ''
    let globalSubs = []
    for (let globalSubber in subList[feed].globalSubs) {
      globalSubs.push(subList[feed].globalSubs[globalSubber])
    }
    globalSubs.sort()
    if (globalSubs.length > 0) list += translate('commands.rssmention.globalSubscribers') + globalSubs.join('\n')

    const filteredSubs = []
    for (let filteredSubber in subList[feed].filteredSubs) {
      filteredSubs.push(subList[feed].filteredSubs[filteredSubber])
    }
    filteredSubs.sort()
    if (filteredSubs.length > 0) list += (globalSubs.length > 0 ? '\n' : '') + translate('commands.rssmention.filteredSubscribers') + filteredSubs.join('\n')
    if (!list) continue
    if (list.length <= 1024) msg.addField(feed, list)
    else {
      const lines = list.split('\n')
      let curStr = ''
      for (let i = 0; i < lines.length; ++i) {
        const line = lines[i]
        if (curStr.length + line.length <= 1000) {
          curStr += line + '\n'
        } else {
          msg.addField(feed, curStr)
          curStr = line
        }
      }
      if (curStr.length > 0) msg.addField(feed, curStr)
    }
  }
  await message.channel.send({ embed: msg })
}

// Remove all subscriptions for a role
async function deleteSubscription (message, guildRss, role, user, translate) {
  const roleID = role ? role.id : undefined
  const userID = user ? user.id : undefined
  const rssList = guildRss.sources
  let found = false

  for (const rssName in rssList) {
    const source = rssList[rssName]
    const subscribers = source.subscribers
    if (!subscribers) continue
    for (let i = subscribers.length - 1; i >= 0; --i) {
      const subscriber = subscribers[i]
      const id = subscriber.id
      if (id === roleID || id === userID) {
        subscribers.splice(i, 1)
        found = true
      }
    }
    if (subscribers && subscribers.length === 0) delete source.subscribers
  }
  const prefix = guildRss.prefix || config.bot.prefix
  if (!found) await message.channel.send(translate('commands.rssmention.removeSubscriptionsNone', { type: role ? translate('commands.rssmention.role') : translate('commands.rssmention.user') }))
  else {
    await dbOpsGuilds.update(guildRss)
    log.command.info(`Deleted all subscriptions`, message.guild, user || role)
    await message.channel.send(`${translate('commands.rssmention.removeSubscriptionsSuccess', { name: role ? role.name : user.username, type: role ? translate('commands.rssmention.role') : translate('commands.rssmention.user') })} ${translate('generics.backupReminder', { prefix })}`)
  }
}

// Add global subscriptions, called from openSubMenu
async function addGlobalSub (message, guildRss, rssName, role, user, translate) {
  const source = guildRss.sources[rssName]
  if (!source.subscribers) source.subscribers = []
  const subscribers = source.subscribers
  const id = role ? role.id : user.id
  const name = role ? role.name : user.username
  const type = role ? 'Role' : 'User'
  let found = false
  for (const subscriber of subscribers) {
    if (id === subscriber.id) {
      found = true
      if (!subscriber.filters) return message.channel.send(translate('commands.rssmention.addSubscriberGlobalExists', { type, name }))
      else delete subscriber.filters
    }
  }
  if (!found) {
    source.subscribers.push({
      id,
      name,
      type: type.toLowerCase()
    })
  }
  const prefix = guildRss.prefix || config.bot.prefix
  await dbOpsGuilds.update(guildRss)
  log.command.info(`Added global subscriber to feed ${source.link}`, message.guild, role || user)
  await message.channel.send(`${translate('commands.rssmention.addSubscriberGlobalSuccess', { link: source.link, name, type: role ? translate('commands.rssmention.role') : translate('commands.rssmention.user') })} ${translate('generics.backupReminder', { prefix })}`)
}

// Remove global subscriptions, called from openSubMenu
async function removeGlobalSub (message, guildRss, rssName, role, user, translate) {
  const source = guildRss.sources[rssName]
  const wantedId = role ? role.id : user.id
  let found = false
  if (!source.subscribers) {
    return message.channel.send(translate('commands.rssmention.removeGlobalSubscriberExists', { link: source.link }))
  }
  const { subscribers } = source
  for (let i = subscribers.length - 1; i >= 0; --i) {
    const subscriber = subscribers[i]
    if (subscriber.id !== wantedId || subscriber.filters) continue
    subscribers.splice(i, 1)
    found = true
  }
  if (!found) {
    return message.channel.send(translate('commands.rssmention.removeGlobalSubscriberExists', { link: source.link }))
  }
  if (subscribers.length === 0) delete source.subscribers

  await dbOpsGuilds.update(guildRss)
  const prefix = guildRss.prefix || config.bot.prefix
  log.command.info(`Removed global subscription for feed ${source.link}`, message.guild, role || user)
  await message.channel.send(`${translate('commands.rssmention.removeGlobalSubscriberSuccess', { type: role ? translate('commands.rssmention.role') : translate('commands.rssmention.user'), name: role ? role.name : `${user.username}#${user.discriminator}`, link: source.link })} ${translate('generics.backupReminder', { prefix })}`)
}

async function filteredSubMenuFn (m, data) {
  const { guildRss, rssName, role, user, translate } = data
  const source = guildRss.sources[rssName]
  const input = m.content // 1 = add, 2 = remove
  if (input === '1') {
    return { ...data,
      next: {
        series: filters.add(m, guildRss, rssName, role, user)
      } }
  } else if (input === '2') {
    if (!source.subscribers || source.subscribers.length === 0) {
      return m.channel.send(translate('commands.rssmention.removeAnySubscriberNone', { link: source.link }))
    }
    return { ...data,
      next: {
        series: filters.remove(m, guildRss, rssName, role, user)
      } }
  } else throw new MenuUtils.MenuOptionError()
}

async function globalSubMenuFn (m, data) {
  const { guildRss, rssName, role, user, translate } = data
  const source = guildRss.sources[rssName]
  const input = m.content // 1 = add, 2 = remove
  if (input === '1') {
    await addGlobalSub(m, guildRss, rssName, role, user, translate)
    return data
  } else if (input === '2') {
    if (!source.subscribers || source.subscribers.length === 0) {
      return m.channel.send(translate('commands.rssmention.removeAnySubscriberNone', { link: source.link }))
    }
    await removeGlobalSub(m, guildRss, rssName, role, user, translate)
    return data
  } else throw new MenuUtils.MenuOptionError()
}

async function getUserOrRoleFn (m, data) {
  const translate = data.translate
  const input = m.content
  const mention = m.mentions.roles.first()
  if (mention) return { ...data, role: mention }
  const role = m.guild.roles.find(r => r.name === input)
  const member = m.guild.members.get(input) || m.mentions.members.first()
  if (input === '@everyone') {
    throw new MenuUtils.MenuOptionError(translate('commands.rssmention.invalidRoleOrUser'))
  } else if (m.guild.roles.filter(r => r.name === input).length > 1) {
    throw new MenuUtils.MenuOptionError(translate('commands.rssmention.multipleRoles'))
  } else if (!role && !member) {
    throw new MenuUtils.MenuOptionError(translate('commands.rssmention.invalidRoleOrUser'))
  }
  return { ...data, role, user: member ? member.user : undefined }
}

async function feedSelectorFn (m, data) {
  const { guildRss, rssName, role, user } = data
  const source = guildRss.sources[rssName]
  const translate = Translator.createLocaleTranslator(guildRss.locale)
  return { ...data,
    next:
    { embed: {
      description: translate('commands.rssmention.selectedRoleDescription', { name: role ? role.name : user.username, feedTitle: source.title, feedLink: source.link }) } }
  }
}

async function selectOptionFn (m, data) {
  const translate = data.translate
  const optionSelected = m.content
  if (!VALID_OPTIONS.includes(optionSelected)) {
    throw new MenuUtils.MenuOptionError()
  }
  const nextData = { ...data, optionSelected: optionSelected }

  if (optionSelected === '4') return nextData
  else if (optionSelected === '3' || optionSelected === '2' || optionSelected === '1') { // Options 1, 2, and 3 requires a role or user to be acquired first
    const getUserOrRole = new MenuUtils.Menu(m, getUserOrRoleFn, { text: translate('commands.rssmention.promptUserOrRole') })
    if (optionSelected === '3') {
      nextData.next = { menu: getUserOrRole }
      return nextData
    }
    const feedSelector = new FeedSelector(m, feedSelectorFn, { command: data.command }, data.guildRss)

    if (optionSelected === '2') { // Filtered Sub Menu
      const filteredSubMenu = new MenuUtils.Menu(m, filteredSubMenuFn)
        .setAuthor(translate('commands.rssmention.globalSubscriptionsTitle'))
        .addOption(translate('commands.rssmention.globalSubscriptionsOptionAdd'), translate('commands.rssmention.globalSubscriptionsOptionAddDescription'))
        .addOption(translate('commands.rssmention.globalSubscriptionsOptionRemove'), translate('commands.rssmention.globalSubscriptionsOptionRemoveDescription'))
      nextData.next = { menu: [getUserOrRole, feedSelector, filteredSubMenu] }
    } else { // Global Sub Menu
      const globalSubMenu = new MenuUtils.Menu(m, globalSubMenuFn)
        .setAuthor(translate('commands.rssmention.filteredSubscriptionsTitle'))
        .addOption(translate('commands.rssmention.filteredSubscriptionsOptionAdd'), translate('commands.rssmention.filteredSubscriptionsOptionAddDescription'))
        .addOption(translate('commands.rssmention.filteredSubscriptionsOptionRemove'), translate('commands.rssmention.filteredSubscriptionsOptionRemoveDescription'))
      nextData.next = { menu: [getUserOrRole, feedSelector, globalSubMenu] }
    }

    return nextData
  }
}

module.exports = async (bot, message, command) => {
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const guildLocale = guildRss ? guildRss.locale : undefined
    const translate = Translator.createLocaleTranslator(guildRss ? guildRss.locale : undefined)
    if (!guildRss || !guildRss.sources || Object.keys(guildRss.sources).length === 0) {
      return await message.channel.send(translate('commands.rssmention.noFeeds'))
    }
    const prefix = guildRss.prefix || config.bot.prefix

    const rssList = guildRss.sources
    const selectOption = new MenuUtils.Menu(message, selectOptionFn)
      .setDescription(translate('commands.rssmention.description', { prefix, channel: message.channel.name }))
      .setAuthor(translate('commands.rssmention.subscriptionOptions'))
      .addOption(translate('commands.rssmention.optionSubscriberFeed'), translate('commands.rssmention.optionSubscriberFeedDescription'))
      .addOption(translate('commands.rssmention.optionFilteredSubscriberFeed'), translate('commands.rssmention.optionFilteredSubscriberFeedDescription'))
      .addOption(translate('commands.rssmention.optionRemoveSubscriptions'), translate('commands.rssmention.optionRemoveSubscriptionsDescription'))
      .addOption(translate('commands.rssmention.optionListSubscriptions'), translate('commands.rssmention.optionListSubscriptionsDescription'))

    const data = await new MenuUtils.MenuSeries(message, [selectOption], { command: command, guildRss, translate, locale: guildLocale }).start()
    if (!data) return
    const { optionSelected, role, user } = data
    if (optionSelected === '4') return await printSubscriptions(message, rssList, translate)
    if (optionSelected === '3') return await deleteSubscription(message, guildRss, role, user, translate)
    // 2 and 1 are handled within the Menu functions due to their complexity
  } catch (err) {
    log.command.warning(`rssmention`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssmention 1', message.guild, err))
  }
}
