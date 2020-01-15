const config = require('../config.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const log = require('../util/logger.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const Format = require('../structs/db/Format.js')
const Feed = require('../structs/db/Feed.js')
const getEmbedProperties = translate => ({
  title: { name: translate('commands.rssembed.title'), description: translate('commands.rssembed.titleDescription') },
  description: { name: translate('commands.rssembed.description'), description: translate('commands.rssembed.descriptionDescription') },
  url: { name: translate('commands.rssembed.url'), description: translate('commands.rssembed.urlDescription') },
  color: { name: translate('commands.rssembed.color'), description: translate('commands.rssembed.colorDescription') },
  timestamp: { name: translate('commands.rssembed.timestamp'), description: translate('commands.rssembed.timestampDescription') },
  footerIconURL: { name: translate('commands.rssembed.footerIconURL'), description: translate('commands.rssembed.footerIconURLDescription') },
  footerText: { name: translate('commands.rssembed.footerText'), description: translate('commands.rssembed.footerTextDescription') },
  thumbnailURL: { name: translate('commands.rssembed.thumbnailURL'), description: translate('commands.rssembed.thumbnailURLDescription') },
  imageURL: { name: translate('commands.rssembed.imageURL'), description: translate('commands.rssembed.imageURLDescription') },
  authorName: { name: translate('commands.rssembed.authorName'), description: translate('commands.rssembed.authorNameDescription') },
  authorURL: { name: translate('commands.rssembed.authorURL'), description: translate('commands.rssembed.authorURLDescription') },
  authorIconURL: { name: translate('commands.rssembed.authorIconURL'), description: translate('commands.rssembed.authorIconURLDescription') }
})

function validate (prop, setting, translate) {
  const lprop = prop.toLowerCase()
  switch (lprop) {
    case 'color':
      return isNaN(parseInt(setting, 10)) ? translate('commands.rssembed.invalidColorNumber') : parseInt(setting, 10) < 0 || parseInt(setting, 10) > 16777215 ? translate('commands.rssembed.invalidColorRange') : true
    case 'thumbnailURL':
    case 'authorAvatarURL':
    case 'imageURL':
    case 'footerIconURL':
      return validImg(setting) ? true : translate('commands.rssembed.invalidURL')
  }
  return true
}

// Check valid image URLs via extensions
function validImg (input) {
  if (input.startsWith('http')) {
    const matches = input.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)
    return !!matches
  } else if (input.startsWith('{')) {
    const results = input.startsWith('{image') ? input.search(/^{image[1-9](\|\|(.+))*}$/) : input.search(/^{(description|image|title):image[1-5](\|\|(.+))*}$/)
    if (results === -1) return false
    const arr = input.split('||')
    if (arr.length === 1) return true
    let valid = true
    for (var x = 0; x < arr.length; ++x) {
      if (!valid) continue
      const term = x === 0 ? `${arr[x]}}` : x === arr.length - 1 ? `{${arr[x]}` : `{${arr[x]}}`
      if (!validImg(term)) valid = false
    }
    return valid
  } else return false
}

async function feedSelectorFn (m, data) {
  const { feed, translate } = data
  let format = await feed.getFormat()
  // Skip embed selection if there is no webhook
  if (!format) {
    const formatData = {
      feed: feed._id
    }
    format = new Format(formatData)
  }

  if (!format.webhook) {
    if (data.setFields) {
      return generateFieldsMenu(m, {
        ...data,
        format,
        selectedEmbedIndex: 0
      })
    } else {
      return generatePropertiesMessage(m, {
        ...data,
        format,
        selectedEmbedIndex: 0
      })
    }
  }

  const selectEmbed = new MenuUtils.Menu(m, selectEmbedFn)
    .setAuthor(translate('commands.rssembed.embedSelection'))
    .setDescription(translate('commands.rssembed.embedSelectionDescription'))
  const embeds = format.embeds
  for (let x = 0; x < embeds.length; ++x) {
    const embed = embeds[0]
    let val = ''
    for (const prop in embed) {
      if (prop !== 'fields') {
        val += `**${prop}:** ${embed[prop]}\n`
      }
    }
    selectEmbed.addOption(x === 0 ? translate('commands.rssembed.defaultEmbed') : translate('commands.rssembed.numberedEmbed', { number: x + 1 }), `${val}\u200b`)
  }

  if (format.embeds.length < 10) {
    selectEmbed.addOption(translate('commands.rssembed.embedSelectionOptionAdd'), translate('commands.rssembed.embedSelectionOptionAddDescription'))
  }
  if (format.embeds.length > 0) {
    selectEmbed.addOption(translate('commands.rssembed.embedSelectionOptionRemoveAll'), `\u200b`)
  }
  return {
    ...data,
    format,
    next: {
      menu: selectEmbed
    }
  }
}

async function selectEmbedFn (m, data) {
  const { format } = data
  const content = m.content
  const embedIndex = parseInt(content, 10) - 1

  // First condition is to add a new embed, second is to remove all embeds
  if (embedIndex !== format.embeds.length && embedIndex !== format.embeds.length + 1 && !format.embeds[embedIndex]) {
    throw new Error('Menu closed due to invalid embed index selected.')
  }

  const nextData = {
    ...data,
    selectedEmbedIndex: embedIndex
  }

  // Remove Embeds
  if (embedIndex === format.embeds.length + 1) {
    return {
      ...data,
      removeAllEmbeds: true
    }
  }

  // Add an embed
  if (data.setFields) {
    return generateFieldsMenu(m, nextData)
  } else {
    return generatePropertiesMessage(m, nextData)
  }
}

async function generateFieldsMenu (m, nextData) {
  const { translate } = nextData
  const fieldActionMenu = new MenuUtils.Menu(m, fieldFunctions.action)
    .setAuthor(translate('commands.rssembed.embedFields'))
    .setDescription(translate('commands.rssembed.embedFieldsDescription'))
    .addOption(translate('commands.rssembed.embedFieldsOptionAddRegular'), translate('commands.rssembed.embedFieldsOptionAddRegularDescription'))
    .addOption(translate('commands.rssembed.embedFieldsOptionAddInline'), translate('commands.rssembed.embedFieldsOptionAddInlineDescription'))
    .addOption(translate('commands.rssembed.embedFieldsOptionAddRegularBlank'), translate('commands.rssembed.embedFieldsOptionAddRegularBlankDescription'))
    .addOption(translate('commands.rssembed.embedFieldsOptionAddInlineBlank'), translate('commands.rssembed.embedFieldsOptionAddInlineBlankDescription'))
    .addOption(translate('commands.rssembed.embedFieldsOptionRemove'), translate('commands.rssembed.embedFieldsOptionRemoveDescription'))

  nextData.next = { menu: fieldActionMenu }
  return nextData
}

async function generatePropertiesMessage (m, nextData) {
  const { feed, format, embedProperties, translate } = nextData
  let currentEmbedProps = `\`\`\`Markdown\n# ${translate('commands.rssembed.currentProperties')} #\n\n`
  let changed = false
  const selectProp = new MenuUtils.Menu(m, selectPropFn)
  const selectedEmbed = format.embeds[nextData.selectedEmbedIndex]
  if (selectedEmbed) {
    for (const property in selectedEmbed) {
      for (const p in embedProperties) {
        if (p === property && selectedEmbed[property]) {
          currentEmbedProps += `[${embedProperties[p].name}]: ${selectedEmbed[property]}\n\n`
          changed = true
        }
      }
    }
  }

  const embedPropertiesKeys = Object.keys(embedProperties)
  const embedPropertiesKeysLen = embedPropertiesKeys.length

  let embedPropertiesListed = `\`\`\`Markdown\n# ${translate('commands.rssembed.availableProperties')} #\n\n`
  for (const pn in embedProperties) {
    const cur = embedProperties[pn]
    embedPropertiesListed += `[${cur.name}]: ${cur.description}\n\n${pn === embedPropertiesKeys[embedPropertiesKeysLen - 1] ? '```' : ''}`
  }

  if (!changed) currentEmbedProps = '```\nNo properties set.\n'
  const m1 = translate('commands.rssembed.currentPropertiesList', { link: feed.url, list: currentEmbedProps })
  const m2 = translate('commands.rssembed.availablePropertiesList', { list: embedPropertiesListed })
  let mFull
  mFull = (m1 + m2).length < 1995 ? `${m1}\n${m2}` : [m1, m2] // Separate into two messages if it exceeds Discord's max length of 2000
  nextData.next = {
    text: mFull,
    menu: selectProp
  }
  return nextData
}

async function selectPropFn (m, data) {
  const input = m.content
  const { embedProperties, translate } = data
  if (input === 'reset') {
    return {
      ...data,
      property: 'resetAll'
    }
  }
  const choices = []
  const arr = input.split(',').map(item => item.trim()).filter((item, index, self) => item && index === self.indexOf(item)) // Trim items, remove empty elements and remove duplicates
  const invalids = []
  for (let q = 0; q < arr.length; ++q) {
    const pChoice = arr[q].toLowerCase()
    let valid = false
    for (const p in embedProperties) {
      if (pChoice === embedProperties[p].name.toLowerCase()) {
        valid = true
        choices.push(p)
      }
    }
    if (!valid) {
      invalids.push(arr[q])
    }
  }

  if (invalids.length > 0) {
    throw new MenuUtils.MenuOptionError(translate('commands.rssembed.invalidProperties', { invalids }))
  }
  if (choices.length === 0) {
    throw new MenuUtils.MenuOptionError(translate('commands.rssembed.noPropertiesSelected'))
  }
  const setMenus = []
  for (let x = 0; x < choices.length; ++x) {
    setMenus.push(new MenuUtils.Menu(m, setProperty))
  }

  data.next = {
    text: choices[0] === 'timestamp' ? translate('commands.rssembed.settingPropertyTimezone') : translate('commands.rssembed.settingProperty', { property: embedProperties[choices[0]].name }),
    menu: setMenus
  }
  return { ...data,
    properties: choices,
    settings: {}
  }
}

async function setProperty (m, data) {
  const { properties, embedProperties, translate } = data
  const property = properties[0]
  const userSetting = m.content.trim()
  if (properties[1]) {
    data.next = {
      text: properties[1] !== 'timestamp' ? translate('commands.rssembed.settingProperty', { property: embedProperties[properties[1]].name }) : translate('commands.rssembed.settingPropertyTimezone')
    }
  }

  if (userSetting.toLowerCase() === 'reset') {
    data.settings[property] = 'reset'
    properties.shift()
    return data
  }

  if (property === 'timestamp') {
    if (userSetting !== 'now' && userSetting !== 'article' && new Date(userSetting).toString() === 'Invalid Date') throw new MenuUtils.MenuOptionError(translate('commands.rssembed.settingPropertyTimezoneError'))
    data.settings[property] = userSetting
    properties.shift()
    return data
  }

  const valid = validate(property, userSetting, translate)
  if (valid === true) data.settings[property] = property === 'color' ? parseInt(userSetting, 10) : userSetting
  else throw new MenuUtils.MenuOptionError(valid)
  properties.shift()
  return data
}

const fieldFunctions = {
  action: async (m, data) => {
    const { feed, format, selectedEmbedIndex, translate } = data
    const input = parseInt(m.content, 10)
    if (isNaN(input) || input < 1 || input > 5) return new MenuUtils.MenuOptionError()

    if (input === 5) {
      // Remove a field
      if (!format.embeds[selectedEmbedIndex] || !format.embeds[selectedEmbedIndex].fields.length === 0) {
        throw new Error(translate('commands.rssembed.embedFieldsRemoveNone'))
      }
      const fields = format.embeds[selectedEmbedIndex].fields
      const rmList = new MenuUtils.Menu(m, fieldFunctions.remove)
        .setAuthor(translate('commands.rssembed.embedFieldsOptionRemoveEmbedTitle'))
        .setDescription(translate('commands.rssembed.embedFieldsOptionRemoveEmbedDescription'))

      for (const field of fields) {
        const inline = field.inline === true ? `(${translate('commands.rssembed.inline')})` : `(${translate('commands.rssembed.regular')})`
        // Empty string name
        if (field.name === '\u200b') {
          rmList.addOption(`${inline} ${translate('commands.rssembed.blankField')}`, '\u200b')
        } else {
          rmList.addOption(`${inline} ${field.name}`, field.value)
        }
      }

      return {
        ...data,
        next: {
          menu: rmList
        }
      }
    } else {
      // Add a field
      if (format.embeds[selectedEmbedIndex] && format.embeds[selectedEmbedIndex].fields.length === 10) {
        throw new Error(translate('commands.rssembed.embedFieldsMaximum'))
      }

      if (input === 3) {
        // Non-inline blank field
        if (!format.embeds[selectedEmbedIndex]) {
          format.embeds.push({ fields: [] })
        }
        format.embeds[selectedEmbedIndex].fields.push({
          name: '\u200b',
          value: '\u200b'
        })
        return {
          ...data,
          successText: translate('commands.rssembed.embedFieldsAddedBlank', { link: feed.url })
        }
      } else if (input === 4) {
        // Inline blank field
        if (!format.embeds[selectedEmbedIndex]) {
          format.embeds.push({ fields: [] })
        }
        format.embeds[selectedEmbedIndex].fields.push({
          name: '\u200b',
          value: '\u200b',
          inline: true
        })
        return {
          ...data,
          successText: translate('commands.rssembed.embedFieldsAddedBlankInline', { link: feed.url })
        }
      }

      const specMenu = new MenuUtils.Menu(m, fieldFunctions.add)
      return { ...data,
        selectedOption: input,
        next:
        { menu: specMenu,
          text: translate('commands.rssembed.embedFieldsSettingPrompt') }
      }
    }
  },
  add: async (m, data) => {
    const { feed, format, selectedOption, selectedEmbedIndex, translate } = data
    const arr = m.content.split('\n')
    while (!arr[0]) {
      arr.shift()
    }
    const name = arr.shift().trim()
    if (!name) {
      throw new MenuUtils.MenuOptionError(translate('commands.rssembed.embedFieldsSettingNoTitle'))
    } else if (name.length > 256) {
      throw new MenuUtils.MenuOptionError(translate('commands.rssembed.embedFieldsSettingTitleLong'))
    }
    const val = arr.join('\n').trim()
    if (val.length > 1024) {
      throw new MenuUtils.MenuOptionError(translate('commands.rssembed.embedFieldsSettingValueLong'))
    }
    const setting = {
      name,
      value: val || '\u200b'
    }
    if (selectedOption === 2) {
      setting.inline = true
    }
    if (!format.embeds[selectedEmbedIndex]) {
      format.embeds.push({
        fields: []
      })
    }
    format.embeds[selectedEmbedIndex].fields.push(setting)
    log.command.info(`Embed field added. Title: '${name}', Value: '${val}'`, m.guild)

    return { ...data,
      successText: translate('commands.rssembed.embedFieldsAdded', {
        type: selectedOption === 2 ? ' inline' : '',
        title: name,
        value: val && val.length > 1500 ? val.slice(0, 1500) + '...' : val || '\u200b',
        link: feed.url
      })
    }
  },
  remove: async (m, data) => {
    const { feed, format, selectedEmbedIndex, translate } = data
    const fields = format.embeds[selectedEmbedIndex].fields
    const inputs = m.content.split(',').map(item => item.trim()).filter((item, index, self) => {
      const num = parseInt(item, 10)
      return item && index === self.indexOf(item) && !isNaN(num) && num > 0 && num <= fields.length
    })
    if (inputs.length === 0) {
      throw new MenuUtils.MenuOptionError()
    }

    for (let x = inputs.length - 1; x >= 0; --x) {
      fields.splice(inputs[x] - 1, 1)
      log.command.info(`Embed field index ${inputs[x] - 1} removed`, m.guild)
    }

    return {
      ...data,
      successText: translate('commands.rssembed.embedFieldsRemoved', {
        numbers: inputs.join(', '),
        link: feed.url
      })
    }
  }
}

module.exports = async (bot, message, command) => {
  // Fields
  try {
    const profile = await GuildProfile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : null
    const feeds = await Feed.getManyBy('guild', message.guild.id)
    const translate = Translator.createLocaleTranslator(guildLocale)
    const embedProperties = getEmbedProperties(translate)
    const setFields = message.content.split(' ')[1] === 'fields'
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command, locale: guildLocale }, feeds)
    const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix

    if (setFields) {
      const fieldsData = await new MenuUtils.MenuSeries(message, [feedSelector], { setFields, embedProperties, translate }).start()
      if (!fieldsData) {
        return
      }
      const { feed, format, successText, removeAllEmbeds } = fieldsData

      if (removeAllEmbeds) {
        format.embeds = []
        if (!format.text) {
          await format.delete()
        } else {
          await format.save()
        }
        log.command.info(`Removing all embeds for ${feed.url}`, message.guild)
        return await message.channel.send(translate('commands.rssembed.removedAllEmbeds'))
      } else {
        await format.save()
        log.command.info(`Updated embed fields for ${feed.url}`, message.guild)
        return await message.channel.send(successText)
      }
    }

    // Regular properties
    const data = await new MenuUtils.MenuSeries(message, [feedSelector], { locale: guildLocale, embedProperties, translate }).start()
    if (!data) {
      return
    }
    const { feed, format, property, settings, selectedEmbedIndex, removeAllEmbeds } = data

    if (removeAllEmbeds) {
      format.embeds = []
      if (!format.text) {
        await format.delete()
      } else {
        await format.save()
      }
      log.command.info(`Removing all embeds for ${feed.url}`, message.guild)

      return await message.channel.send(translate('commands.rssembed.removedAllEmbeds'))
    }

    if (property === 'resetAll') {
      format.embeds.splice(selectedEmbedIndex, 1)
      log.command.info(`Embed resetting for ${feed.url}`, message.guild)
      if (format.embeds.length === 0 && !format.text) {
        await format.delete()
      } else {
        await format.save()
      }
      return await message.channel.send(translate('commands.rssembed.removedEmbed', { link: feed.url }))
    }

    let updated = ''
    let reset = ''
    for (const prop in settings) {
      const propName = embedProperties[prop].name
      const userSetting = settings[prop]
      if (userSetting === 'reset') {
        if (!format.embeds[selectedEmbedIndex] || !format.embeds[selectedEmbedIndex][prop]) {
          reset += translate('commands.rssembed.resetNothing', { propName })
          continue
        }
        delete format.embeds[selectedEmbedIndex][prop]
        if (format.text === '{empty}') {
          format.text = undefined
        }

        log.command.info(`Property '${prop}' resetting for ${feed.url}`, message.guild)
        reset += translate('commands.rssembed.resetSuccess', { propName })
        continue
      }
      if (!format.embeds[selectedEmbedIndex]) {
        format.embeds.push({})
        log.command.info(`Adding new embed for ${feed.url}`, message.guild)
      }
      format.embeds[selectedEmbedIndex][prop] = userSetting
      log.command.info(`Embed updating for ${feed.url}. Property '${prop}' set to '${userSetting}'`, message.guild)
      updated += translate('commands.rssembed.updatedSuccess', { propName, userSetting })
    }
    await format.save()

    // Validation may remove empty embeds during save
    if (!format.text && format.embeds.length === 0) {
      await format.delete()
    }

    await message.channel.send(`${translate('commands.rssembed.updatedInfo', { link: feed.url, resetList: reset, updateList: updated, prefix })} ${translate('generics.backupReminder', { prefix })}`, { split: true })
  } catch (err) {
    log.command.warning(`rssembed`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssembed 1', message.guild, err))
  }
}
