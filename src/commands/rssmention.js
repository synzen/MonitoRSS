const Discord = require('discord.js')
const filters = require('./util/filters.js')
const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const Subscriber = require('../structs/db/Subscriber.js')
const Feed = require('../structs/db/Feed.js')
const VALID_OPTIONS = ['1', '2', '3', '4']

async function printSubscriptions (message, feeds, translate) {
  const guild = message.guild
  const subList = {}
  const msg = new Discord.RichEmbed()
    .setColor(config.bot.menuColor)
    .setDescription(translate('commands.rssmention.listSubscriptionsDescription'))
    .setAuthor(translate('commands.rssmention.subscriptionsList'))

  const allSubscribers = await Promise.all(feeds.map(feed => feed.getSubscribers()))
  for (let i = 0; i < allSubscribers.length; ++i) {
    const feed = feeds[i]
    const subscribers = allSubscribers[i]
    for (const subscriber of subscribers) {
      const id = subscriber.id
      const type = subscriber.type
      if (!subList[feed.title]) {
        subList[feed.title] = {}
      }
      const embedReferenceTitle = !subscriber.hasFilters() ? 'globalSubs' : 'filteredSubs'
      if (!subList[feed.title][embedReferenceTitle]) {
        subList[feed.title][embedReferenceTitle] = []
      }
      if (type === 'user') {
        const resolvedUser = guild.members.get(id)
        const toInsert = resolvedUser ? `${resolvedUser.user.username}#${resolvedUser.user.discriminator}` : ''
        if (resolvedUser && !subList[feed.title][embedReferenceTitle].includes(toInsert)) {
          subList[feed.title][embedReferenceTitle].push(toInsert)
        }
      } else if (type === 'role') {
        const resolvedRole = guild.roles.get(id)
        const toInsert = resolvedRole ? resolvedRole.name : ''
        if (resolvedRole && !subList[feed.title][embedReferenceTitle].includes(toInsert)) {
          subList[feed.title][embedReferenceTitle].push(toInsert)
        }
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
    if (globalSubs.length > 0) {
      list += translate('commands.rssmention.globalSubscribers') + globalSubs.join('\n')
    }

    const filteredSubs = []
    for (let filteredSubber in subList[feed].filteredSubs) {
      filteredSubs.push(subList[feed].filteredSubs[filteredSubber])
    }
    filteredSubs.sort()
    if (filteredSubs.length > 0) {
      list += (globalSubs.length > 0 ? '\n' : '') + translate('commands.rssmention.filteredSubscribers') + filteredSubs.join('\n')
    }
    if (!list) {
      continue
    }
    if (list.length <= 1024) {
      msg.addField(feed, list)
    } else {
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
      if (curStr.length > 0) {
        msg.addField(feed, curStr)
      }
    }
  }
  await message.channel.send({ embed: msg })
}

// Remove all subscriptions for a role
async function deleteSubscription (message, profile, feeds, role, user) {
  const roleID = role ? role.id : undefined
  const userID = user ? user.id : undefined
  const matchID = roleID || userID
  const prefix = profile.prefix || config.bot.prefix
  const translate = Translator.createLocaleTranslator(profile.locale)

  const allSubscribers = await Promise.all(feeds.map(feed => feed.getSubscribers()))

  for (let i = 0; i < allSubscribers.length; ++i) {
    const subscribers = allSubscribers[i]
    if (subscribers.length === 0) {
      continue
    }
    const subscriber = subscribers.find(subscriber => subscriber.id === matchID)
    if (subscriber) {
      await subscriber.delete()
      log.command.info(`Deleted all subscriptions`, message.guild, user || role)
      await message.channel.send(`${translate('commands.rssmention.removeSubscriptionsSuccess', {
        name: role ? role.name : user.username,
        type: role ? translate('commands.rssmention.role') : translate('commands.rssmention.user')
      })} ${translate('generics.backupReminder', { prefix })}`)
      return
    }
  }

  await message.channel.send(translate('commands.rssmention.removeSubscriptionsNone', {
    type: role ? translate('commands.rssmention.role') : translate('commands.rssmention.user')
  }))
}

// Add global subscriptions, called from openSubMenu
async function addGlobalSub (message, profile, feed, role, user, translate) {
  const subscribers = await feed.getSubscribers()
  const id = role ? role.id : user.id
  const name = role ? role.name : user.username
  const type = role ? 'Role' : 'User'
  const found = subscribers.find(sub => sub.id === id)
  if (found) {
    if (!found.hasFilters()) {
      return message.channel.send(translate('commands.rssmention.addSubscriberGlobalExists', { type, name }))
    }
    await found.removeFilters()
  } else {
    const subscriber = new Subscriber({
      feed: feed._id,
      id,
      type: type.toLowerCase()
    })
    await subscriber.save()
  }

  const prefix = profile.prefix || config.bot.prefix
  log.command.info(`Added global subscriber to feed ${feed.url}`, message.guild, role || user)
  await message.channel.send(`${translate('commands.rssmention.addSubscriberGlobalSuccess', {
    link: feed.url,
    name,
    type: role ? translate('commands.rssmention.role') : translate('commands.rssmention.user')
  })} ${translate('generics.backupReminder', { prefix })}`)
}

// Remove global subscriptions, called from openSubMenu
async function removeGlobalSub (message, profile, feed, role, user, translate) {
  const subscribers = await feed.getSubscribers()
  if (subscribers.length === 0) {
    return message.channel.send(translate('commands.rssmention.removeAnySubscriberNone', { link: feed.url }))
  }
  const prefix = profile.prefix || config.bot.prefix
  const matchID = role ? role.id : user.id
  const found = subscribers.find(sub => sub.id === matchID && !sub.hasFilters())
  if (found) {
    await found.delete()
    log.command.info(`Removed global subscription for feed ${feed.url}`, message.guild, role || user)
    return message.channel.send(`${translate('commands.rssmention.removeGlobalSubscriberSuccess', {
      type: role ? translate('commands.rssmention.role') : translate('commands.rssmention.user'),
      name: role ? role.name : `${user.username}#${user.discriminator}`,
      link: feed.url
    })} ${translate('generics.backupReminder', { prefix })}`)
  }
  await message.channel.send(translate('commands.rssmention.removeGlobalSubscriberExists', { link: feed.url }))
}

async function filteredSubMenuFn (m, data) {
  const { profile, feed, role, user, translate } = data
  const input = m.content // 1 = add, 2 = remove
  if (input === '1') {
    return {
      ...data,
      next: {
        series: await filters.add(m, profile, feed, role, user)
      } }
  } else if (input === '2') {
    const subscribers = await feed.getSubscribers()
    if (subscribers.length === 0) {
      return m.channel.send(translate('commands.rssmention.removeAnySubscriberNone', { link: feed.url }))
    }
    return {
      ...data,
      next: {
        series: await filters.remove(m, profile, feed, role, user)
      } }
  } else throw new MenuUtils.MenuOptionError()
}

async function globalSubMenuFn (m, data) {
  const { profile, feed, role, user, translate } = data
  const input = m.content // 1 = add, 2 = remove
  if (input === '1') {
    await addGlobalSub(m, profile, feed, role, user, translate)
    return data
  } else if (input === '2') {
    await removeGlobalSub(m, profile, feed, role, user, translate)
    return data
  } else throw new MenuUtils.MenuOptionError()
}

async function getUserOrRoleFn (m, data) {
  const translate = data.translate
  const input = m.content
  const mention = m.mentions.roles.first()
  if (mention) {
    return {
      ...data,
      role: mention
    }
  }
  const role = m.guild.roles.find(r => r.name === input)
  const member = m.guild.members.get(input) || m.mentions.members.first()
  if (input === '@everyone') {
    throw new MenuUtils.MenuOptionError(translate('commands.rssmention.invalidRoleOrUser'))
  } else if (m.guild.roles.filter(r => r.name === input).length > 1) {
    throw new MenuUtils.MenuOptionError(translate('commands.rssmention.multipleRoles'))
  } else if (!role && !member) {
    throw new MenuUtils.MenuOptionError(translate('commands.rssmention.invalidRoleOrUser'))
  }
  return {
    ...data,
    role,
    user: member ? member.user : undefined
  }
}

async function feedSelectorFn (m, data) {
  const { profile, feed, role, user } = data
  const translate = Translator.createLocaleTranslator(profile.locale)
  return {
    ...data,
    next: {
      embed: {
        description: translate('commands.rssmention.selectedRoleDescription', { name: role ? role.name : user.username, feedTitle: feed.title, feedLink: feed.url })
      }
    }
  }
}

async function selectOptionFn (m, data) {
  const translate = data.translate
  const optionSelected = m.content
  if (!VALID_OPTIONS.includes(optionSelected)) {
    throw new MenuUtils.MenuOptionError()
  }
  const nextData = {
    ...data,
    optionSelected
  }

  if (optionSelected === '4') {
    return nextData
  } else if (optionSelected === '3' || optionSelected === '2' || optionSelected === '1') { // Options 1, 2, and 3 requires a role or user to be acquired first
    const getUserOrRole = new MenuUtils.Menu(m, getUserOrRoleFn, { text: translate('commands.rssmention.promptUserOrRole') })
    if (optionSelected === '3') {
      nextData.next = {
        menu: getUserOrRole
      }
      return nextData
    }
    const { command, locale, feeds } = data
    const feedSelector = new FeedSelector(m, feedSelectorFn, {
      command,
      locale
    }, feeds)

    if (optionSelected === '2') { // Filtered Sub Menu
      const filteredSubMenu = new MenuUtils.Menu(m, filteredSubMenuFn)
        .setAuthor(translate('commands.rssmention.filteredSubscriptionsTitle'))
        .addOption(translate('commands.rssmention.filteredSubscriptionsOptionAdd'), translate('commands.rssmention.filteredSubscriptionsOptionAddDescription'))
        .addOption(translate('commands.rssmention.filteredSubscriptionsOptionRemove'), translate('commands.rssmention.filteredSubscriptionsOptionRemoveDescription'))
      nextData.next = { menu: [getUserOrRole, feedSelector, filteredSubMenu] }
    } else { // Global Sub Menu
      const globalSubMenu = new MenuUtils.Menu(m, globalSubMenuFn)
        .setAuthor(translate('commands.rssmention.globalSubscriptionsTitle'))
        .addOption(translate('commands.rssmention.globalSubscriptionsOptionAdd'), translate('commands.rssmention.globalSubscriptionsOptionAddDescription'))
        .addOption(translate('commands.rssmention.globalSubscriptionsOptionRemove'), translate('commands.rssmention.globalSubscriptionsOptionRemoveDescription'))
      nextData.next = { menu: [getUserOrRole, feedSelector, globalSubMenu] }
    }

    return nextData
  }
}

module.exports = async (bot, message, command) => {
  try {
    const profile = await GuildProfile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    if (feeds.length === 0) {
      return await message.channel.send(translate('commands.rssmention.noFeeds'))
    }
    const prefix = profile.prefix || config.bot.prefix

    const selectOption = new MenuUtils.Menu(message, selectOptionFn)
      .setDescription(translate('commands.rssmention.description', { prefix, channel: message.channel.name }))
      .setAuthor(translate('commands.rssmention.subscriptionOptions'))
      .addOption(translate('commands.rssmention.optionSubscriberFeed'), translate('commands.rssmention.optionSubscriberFeedDescription'))
      .addOption(translate('commands.rssmention.optionFilteredSubscriberFeed'), translate('commands.rssmention.optionFilteredSubscriberFeedDescription'))
      .addOption(translate('commands.rssmention.optionRemoveSubscriptions'), translate('commands.rssmention.optionRemoveSubscriptionsDescription'))
      .addOption(translate('commands.rssmention.optionListSubscriptions'), translate('commands.rssmention.optionListSubscriptionsDescription'))

    const data = await new MenuUtils.MenuSeries(message, [selectOption], { command, feeds, profile, translate, locale: guildLocale }).start()
    if (!data) {
      return
    }
    const { optionSelected, role, user } = data
    if (optionSelected === '4') {
      return await printSubscriptions(message, feeds, translate)
    }
    if (optionSelected === '3') {
      return await deleteSubscription(message, profile, feeds, role, user)
    }
    // 2 and 1 are handled within the Menu functions due to their complexity
  } catch (err) {
    log.command.warning(`rssmention`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssmention 1', message.guild, err))
  }
}
