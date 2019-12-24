const config = require('../config.js')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')

const getProperties = translate => {
  const ENABLED_TRANSLATED = translate('generics.enabledLower')
  const DISABLED_TRANSLATED = translate('generics.disabledLower')

  return {
    checkTitles: {
      title: translate('commands.rssoptions.titleChecksToggle'),
      description: `**${translate('commands.rssoptions.onlyIfNecessary')}** ${translate('generics.defaultSetting', { value: config.feeds.checkTitles === true ? ENABLED_TRANSLATED : DISABLED_TRANSLATED })} ${translate('commands.rssoptions.titleChecksDescription')}`,
      display: translate('commands.rssoptions.titleChecks'),
      num: 1
    },
    imgPreviews: {
      title: translate('commands.rssoptions.imagePreviewsToggle'),
      description: `${translate('generics.defaultSetting', { value: config.feeds.imgPreviews === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED })} ${translate('commands.rssoptions.imagePreviewsDescription')}`,
      display: translate('commands.rssoptions.imagePreviews'),
      num: 2
    },
    imgLinksExistence: {
      title: translate('commands.rssoptions.imageLinksExistenceToggle'),
      description: `${translate('generics.defaultSetting', { value: config.feeds.imgLinksExistence === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED })} ${translate('commands.rssoptions.imageLinksExistenceDescription')}`,
      display: translate('commands.rssoptions.imageLinksExistence'),
      num: 3
    },
    checkDates: {
      title: translate('commands.rssoptions.dateChecksToggle'),
      description: `${translate('generics.defaultSetting', { value: config.feeds.checkDates === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED })} ${translate('commands.rssoptions.dateChecksDescription', { cycleMaxAge: config.feeds.cycleMaxAge })}`,
      display: translate('commands.rssoptions.dateChecks'),
      num: 4
    },
    formatTables: {
      title: translate('commands.rssoptions.tableFormattingToggle'),
      description: `${translate('generics.defaultSetting', { value: config.feeds.formatTables === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED })} ${translate('commands.rssoptions.tableFormattingDescription')}`,
      display: translate('commands.rssoptions.tableFormatting'),
      num: 5
    },
    toggleRoleMentions: {
      title: translate('commands.rssoptions.roleMentioningToggle'),
      description: `${translate('generics.defaultSetting', { value: config.feeds.toggleRoleMentions === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED })} ${translate('commands.rssoptions.roleMentioningDescription')}`,
      display: translate('commands.rssoptions.roleMentioning'),
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
    const profile = await GuildProfile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
    const feeds = profile ? await profile.getFeeds() : []
    const translate = Translator.createLocaleTranslator(guildLocale)
    const select = new MenuUtils.Menu(message, selectOption)
      .setAuthor(translate('commands.rssoptions.miscFeedOptions'))
      .setDescription(translate('commands.rssoptions.selectOption'))

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

    const globalSetting = config.feeds[chosenProp]
    const specificSetting = feed[chosenProp]

    feed[chosenProp] = typeof specificSetting === 'boolean' ? !specificSetting : !globalSetting

    const finalSetting = feed[chosenProp]

    if (feed[chosenProp] === globalSetting) {
      // null marks it for deletion
      feed[chosenProp] = null
    }

    const prettyPropName = properties[chosenProp].display

    await feed.save()
    log.command.info(`${prettyPropName} ${finalSetting ? 'enabled' : 'disabled'} for feed linked ${feed.url}. ${feed[chosenProp] === null ? 'Now following global settings.' : ''}`, message.guild)
    await message.channel.send(`${translate('commands.rssoptions.settingChanged', {
      propName: prettyPropName,
      isDefault: feed[chosenProp] === null ? ` (${translate('commands.rssoptions.defaultSetting')})` : '',
      link: feed.url,
      finalSetting: finalSetting ? translate('generics.enabledLower') : translate('generics.disabledLower')
    })} ${translate('generics.backupReminder', { prefix: profile.prefix || config.bot.prefix })}`)
  } catch (err) {
    log.command.warning(`rssoptions`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssoptions 1', message.guild, err))
  }
}
