const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')

const getProperties = translate => {
  const ENABLED_TRANSLATED = translate('generics.enabledLower')
  const DISABLED_TRANSLATED = translate('generics.disabledLower')

  return {
    checkTitles: {
      title: translate('commands.options.titleChecksToggle'),
      description: `**${translate('commands.options.onlyIfNecessary')}** ${translate('generics.defaultSetting', { value: config.feeds.checkTitles === true ? ENABLED_TRANSLATED : DISABLED_TRANSLATED })} ${translate('commands.options.titleChecksDescription')}`,
      display: translate('commands.options.titleChecks'),
      num: 1
    },
    imgPreviews: {
      title: translate('commands.options.imagePreviewsToggle'),
      description: `${translate('generics.defaultSetting', { value: config.feeds.imgPreviews === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED })} ${translate('commands.options.imagePreviewsDescription')}`,
      display: translate('commands.options.imagePreviews'),
      num: 2
    },
    imgLinksExistence: {
      title: translate('commands.options.imageLinksExistenceToggle'),
      description: `${translate('generics.defaultSetting', { value: config.feeds.imgLinksExistence === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED })} ${translate('commands.options.imageLinksExistenceDescription')}`,
      display: translate('commands.options.imageLinksExistence'),
      num: 3
    },
    checkDates: {
      title: translate('commands.options.dateChecksToggle'),
      description: `${translate('generics.defaultSetting', { value: config.feeds.checkDates === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED })} ${translate('commands.options.dateChecksDescription', { cycleMaxAge: config.feeds.cycleMaxAge })}`,
      display: translate('commands.options.dateChecks'),
      num: 4
    },
    formatTables: {
      title: translate('commands.options.tableFormattingToggle'),
      description: `${translate('generics.defaultSetting', { value: config.feeds.formatTables === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED })} ${translate('commands.options.tableFormattingDescription')}`,
      display: translate('commands.options.tableFormatting'),
      num: 5
    },
    toggleRoleMentions: {
      title: translate('commands.options.roleMentioningToggle'),
      description: `${translate('generics.defaultSetting', { value: config.feeds.toggleRoleMentions === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED })} ${translate('commands.options.roleMentioningDescription')}`,
      display: translate('commands.options.roleMentioning'),
      num: 6
    }
  }
}

async function selectOption (m, data) {
  const input = m.content
  if (input !== '1' && input !== '2' && input !== '3' && input !== '4' && input !== '5' && input !== '6') {
    throw new MenuUtils.MenuOptionError()
  }
  const num = parseInt(input, 10)
  let chosenProp
  const translate = Translator.createLocaleTranslator(data.locale)
  const properties = getProperties(translate)
  for (const propRef in properties) {
    if (properties[propRef].num === num) chosenProp = propRef
  }

  return { ...data,
    chosenProp: chosenProp,
    next: {
      menu: new FeedSelector(m, null, {
        command: data.command,
        miscOption: chosenProp,
        locale: data.locale
      }, data.feeds)
    } }
}

module.exports = async (bot, message, command) => {
  try {
    const profile = await Profile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    const translate = Translator.createLocaleTranslator(guildLocale)
    const select = new MenuUtils.Menu(message, selectOption)
      .setAuthor(translate('commands.options.miscFeedOptions'))
      .setDescription(translate('commands.options.selectOption'))

    const properties = getProperties(translate)
    for (const propRef in properties) {
      const data = properties[propRef]
      select.addOption(data.title, data.description)
    }
    const data = await new MenuUtils.MenuSeries(message, [select], {
      command,
      profile,
      feeds,
      locale: guildLocale
    }).start()

    if (!data) return
    const { feed, chosenProp } = data
    const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix

    const globalSetting = config.feeds[chosenProp]
    const specificSetting = feed[chosenProp]

    feed[chosenProp] = typeof specificSetting === 'boolean' ? !specificSetting : !globalSetting

    const finalSetting = feed[chosenProp]

    if (feed[chosenProp] === globalSetting) {
      // undefined marks it for deletion
      feed[chosenProp] = undefined
    }

    const prettyPropName = properties[chosenProp].display

    await feed.save()
    log.command.info(`${prettyPropName} ${finalSetting ? 'enabled' : 'disabled'} for feed linked ${feed.url}. ${feed[chosenProp] === undefined ? 'Now following global settings.' : ''}`, message.guild)
    await message.channel.send(`${translate('commands.options.settingChanged', {
      propName: prettyPropName,
      isDefault: feed[chosenProp] === undefined ? ` (${translate('commands.options.defaultSetting')})` : '',
      link: feed.url,
      finalSetting: finalSetting ? translate('generics.enabledLower') : translate('generics.disabledLower')
    })} ${translate('generics.backupReminder', { prefix })}`)
  } catch (err) {
    log.command.warning(`rssoptions`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssoptions 1', message.guild, err))
  }
}
