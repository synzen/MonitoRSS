const config = require('../config.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const log = require('../util/logger.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const getEmbedProperties = translate => ({
  title: { name: translate('commands.embed.title'), description: translate('commands.embed.titleDescription') },
  description: { name: translate('commands.embed.description'), description: translate('commands.embed.descriptionDescription') },
  url: { name: translate('commands.embed.url'), description: translate('commands.embed.urlDescription') },
  color: { name: translate('commands.embed.color'), description: translate('commands.embed.colorDescription') },
  timestamp: { name: translate('commands.embed.timestamp'), description: translate('commands.embed.timestampDescription') },
  footerIconURL: { name: translate('commands.embed.footerIconURL'), description: translate('commands.embed.footerIconURLDescription') },
  footerText: { name: translate('commands.embed.footerText'), description: translate('commands.embed.footerTextDescription') },
  thumbnailURL: { name: translate('commands.embed.thumbnailURL'), description: translate('commands.embed.thumbnailURLDescription') },
  imageURL: { name: translate('commands.embed.imageURL'), description: translate('commands.embed.imageURLDescription') },
  authorName: { name: translate('commands.embed.authorName'), description: translate('commands.embed.authorNameDescription') },
  authorURL: { name: translate('commands.embed.authorURL'), description: translate('commands.embed.authorURLDescription') },
  authorIconURL: { name: translate('commands.embed.authorIconURL'), description: translate('commands.embed.authorIconURLDescription') }
})

function validate (prop, setting, translate) {
  const lprop = prop.toLowerCase()
  switch (lprop) {
    case 'color':
      return isNaN(parseInt(setting, 10)) ? translate('commands.embed.invalidColorNumber') : parseInt(setting, 10) < 0 || parseInt(setting, 10) > 16777215 ? translate('commands.embed.invalidColorRange') : true
    case 'thumbnailURL':
    case 'authorAvatarURL':
    case 'imageURL':
    case 'footerIconURL':
      return validImg(setting) ? true : translate('commands.embed.invalidURL')
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
  // Skip embed selection if there is no webhook

  if (!feed.webhook) {
    if (data.setFields) {
      return generateFieldsMenu(m, {
        ...data,
        selectedEmbedIndex: 0
      })
    } else {
      return generatePropertiesMessage(m, {
        ...data,
        selectedEmbedIndex: 0
      })
    }
  }

  const selectEmbed = new MenuUtils.Menu(m, selectEmbedFn)
    .setAuthor(translate('commands.embed.embedSelection'))
    .setDescription(translate('commands.embed.embedSelectionDescription'))
  const embeds = feed.embeds
  for (let x = 0; x < embeds.length; ++x) {
    const embed = embeds[0]
    let val = ''
    for (const prop in embed) {
      if (prop !== 'fields') {
        val += `**${prop}:** ${embed[prop]}\n`
      }
    }
    selectEmbed.addOption(x === 0 ? translate('commands.embed.defaultEmbed') : translate('commands.embed.numberedEmbed', { number: x + 1 }), `${val}\u200b`)
  }

  if (feed.embeds.length < 10) {
    selectEmbed.addOption(translate('commands.embed.embedSelectionOptionAdd'), translate('commands.embed.embedSelectionOptionAddDescription'))
  }
  if (feed.embeds.length > 0) {
    selectEmbed.addOption(translate('commands.embed.embedSelectionOptionRemoveAll'), `\u200b`)
  }
  return {
    ...data,
    next: {
      menu: selectEmbed
    }
  }
}

async function selectEmbedFn (m, data) {
  const { feed } = data
  const content = m.content
  const embedIndex = parseInt(content, 10) - 1

  // First condition is to add a new embed, second is to remove all embeds
  if (embedIndex !== feed.embeds.length && embedIndex !== feed.embeds.length + 1 && !feed.embeds[embedIndex]) {
    throw new Error('Menu closed due to invalid embed index selected.')
  }

  const nextData = {
    ...data,
    selectedEmbedIndex: embedIndex
  }

  // Remove Embeds
  if (embedIndex === feed.embeds.length + 1) {
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
    .setAuthor(translate('commands.embed.embedFields'))
    .setDescription(translate('commands.embed.embedFieldsDescription'))
    .addOption(translate('commands.embed.embedFieldsOptionAddRegular'), translate('commands.embed.embedFieldsOptionAddRegularDescription'))
    .addOption(translate('commands.embed.embedFieldsOptionAddInline'), translate('commands.embed.embedFieldsOptionAddInlineDescription'))
    .addOption(translate('commands.embed.embedFieldsOptionAddRegularBlank'), translate('commands.embed.embedFieldsOptionAddRegularBlankDescription'))
    .addOption(translate('commands.embed.embedFieldsOptionAddInlineBlank'), translate('commands.embed.embedFieldsOptionAddInlineBlankDescription'))
    .addOption(translate('commands.embed.embedFieldsOptionRemove'), translate('commands.embed.embedFieldsOptionRemoveDescription'))

  nextData.next = { menu: fieldActionMenu }
  return nextData
}

async function generatePropertiesMessage (m, nextData) {
  const { feed, embedProperties, translate } = nextData
  let currentEmbedProps = `\`\`\`Markdown\n# ${translate('commands.embed.currentProperties')} #\n\n`
  let changed = false
  const selectProp = new MenuUtils.Menu(m, selectPropFn)
  const selectedEmbed = feed.embeds[nextData.selectedEmbedIndex]
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

  let embedPropertiesListed = `\`\`\`Markdown\n# ${translate('commands.embed.availableProperties')} #\n\n`
  for (const pn in embedProperties) {
    const cur = embedProperties[pn]
    embedPropertiesListed += `[${cur.name}]: ${cur.description}\n\n${pn === embedPropertiesKeys[embedPropertiesKeysLen - 1] ? '```' : ''}`
  }

  if (!changed) currentEmbedProps = '```\nNo properties set.\n'
  const m1 = translate('commands.embed.currentPropertiesList', { link: feed.url, list: currentEmbedProps })
  const m2 = translate('commands.embed.availablePropertiesList', { list: embedPropertiesListed })
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
    throw new MenuUtils.MenuOptionError(translate('commands.embed.invalidProperties', { invalids }))
  }
  if (choices.length === 0) {
    throw new MenuUtils.MenuOptionError(translate('commands.embed.noPropertiesSelected'))
  }
  const setMenus = []
  for (let x = 0; x < choices.length; ++x) {
    setMenus.push(new MenuUtils.Menu(m, setProperty))
  }

  data.next = {
    text: choices[0] === 'timestamp' ? translate('commands.embed.settingPropertyTimezone') : translate('commands.embed.settingProperty', { property: embedProperties[choices[0]].name }),
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
      text: properties[1] !== 'timestamp' ? translate('commands.embed.settingProperty', { property: embedProperties[properties[1]].name }) : translate('commands.embed.settingPropertyTimezone')
    }
  }

  if (userSetting.toLowerCase() === 'reset') {
    data.settings[property] = 'reset'
    properties.shift()
    return data
  }

  if (property === 'timestamp') {
    if (userSetting !== 'now' && userSetting !== 'article' && new Date(userSetting).toString() === 'Invalid Date') throw new MenuUtils.MenuOptionError(translate('commands.embed.settingPropertyTimezoneError'))
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
    const { feed, selectedEmbedIndex, translate } = data
    const input = parseInt(m.content, 10)
    if (isNaN(input) || input < 1 || input > 5) return new MenuUtils.MenuOptionError()

    if (input === 5) {
      // Remove a field
      if (!feed.embeds[selectedEmbedIndex] || !feed.embeds[selectedEmbedIndex].fields.length === 0) {
        throw new Error(translate('commands.embed.embedFieldsRemoveNone'))
      }
      const fields = feed.embeds[selectedEmbedIndex].fields
      const rmList = new MenuUtils.Menu(m, fieldFunctions.remove)
        .setAuthor(translate('commands.embed.embedFieldsOptionRemoveEmbedTitle'))
        .setDescription(translate('commands.embed.embedFieldsOptionRemoveEmbedDescription'))

      for (const field of fields) {
        const inline = field.inline === true ? `(${translate('commands.embed.inline')})` : `(${translate('commands.embed.regular')})`
        // Empty string name
        if (field.name === '\u200b') {
          rmList.addOption(`${inline} ${translate('commands.embed.blankField')}`, '\u200b')
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
      if (feed.embeds[selectedEmbedIndex] && feed.embeds[selectedEmbedIndex].fields.length === 10) {
        throw new Error(translate('commands.embed.embedFieldsMaximum'))
      }

      if (input === 3) {
        // Non-inline blank field
        if (!feed.embeds[selectedEmbedIndex]) {
          feed.embeds.push({ fields: [] })
        }
        feed.embeds[selectedEmbedIndex].fields.push({
          name: '\u200b',
          value: '\u200b'
        })
        return {
          ...data,
          successText: translate('commands.embed.embedFieldsAddedBlank', { link: feed.url })
        }
      } else if (input === 4) {
        // Inline blank field
        if (!feed.embeds[selectedEmbedIndex]) {
          feed.embeds.push({ fields: [] })
        }
        feed.embeds[selectedEmbedIndex].fields.push({
          name: '\u200b',
          value: '\u200b',
          inline: true
        })
        return {
          ...data,
          successText: translate('commands.embed.embedFieldsAddedBlankInline', { link: feed.url })
        }
      }

      const specMenu = new MenuUtils.Menu(m, fieldFunctions.add)
      return { ...data,
        selectedOption: input,
        next:
        { menu: specMenu,
          text: translate('commands.embed.embedFieldsSettingPrompt') }
      }
    }
  },
  add: async (m, data) => {
    const { feed, selectedOption, selectedEmbedIndex, translate } = data
    const arr = m.content.split('\n')
    while (!arr[0]) {
      arr.shift()
    }
    const name = arr.shift().trim()
    if (!name) {
      throw new MenuUtils.MenuOptionError(translate('commands.embed.embedFieldsSettingNoTitle'))
    } else if (name.length > 256) {
      throw new MenuUtils.MenuOptionError(translate('commands.embed.embedFieldsSettingTitleLong'))
    }
    const val = arr.join('\n').trim()
    if (val.length > 1024) {
      throw new MenuUtils.MenuOptionError(translate('commands.embed.embedFieldsSettingValueLong'))
    }
    const setting = {
      name,
      value: val || '\u200b'
    }
    if (selectedOption === 2) {
      setting.inline = true
    }
    if (!feed.embeds[selectedEmbedIndex]) {
      feed.embeds.push({
        fields: []
      })
    }
    feed.embeds[selectedEmbedIndex].fields.push(setting)
    log.command.info(`Embed field added. Title: '${name}', Value: '${val}'`, m.guild)

    return { ...data,
      successText: translate('commands.embed.embedFieldsAdded', {
        type: selectedOption === 2 ? ' inline' : '',
        title: name,
        value: val && val.length > 1500 ? val.slice(0, 1500) + '...' : val || '\u200b',
        link: feed.url
      })
    }
  },
  remove: async (m, data) => {
    const { feed, selectedEmbedIndex, translate } = data
    const fields = feed.embeds[selectedEmbedIndex].fields
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
      successText: translate('commands.embed.embedFieldsRemoved', {
        numbers: inputs.join(', '),
        link: feed.url
      })
    }
  }
}

module.exports = async (bot, message, command) => {
  // Fields
  try {
    const profile = await Profile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
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
      const { feed, successText, removeAllEmbeds } = fieldsData

      if (removeAllEmbeds) {
        feed.embeds = []
        if (!feed.text) {
          await feed.delete()
        } else {
          await feed.save()
        }
        log.command.info(`Removing all embeds for ${feed.url}`, message.guild)
        return await message.channel.send(translate('commands.embed.removedAllEmbeds'))
      } else {
        await feed.save()
        log.command.info(`Updated embed fields for ${feed.url}`, message.guild)
        return await message.channel.send(successText)
      }
    }

    // Regular properties
    const data = await new MenuUtils.MenuSeries(message, [feedSelector], { locale: guildLocale, embedProperties, translate }).start()
    if (!data) {
      return
    }
    const { feed, property, settings, selectedEmbedIndex, removeAllEmbeds } = data

    if (removeAllEmbeds) {
      feed.embeds = []
      if (!feed.text) {
        await feed.delete()
      } else {
        await feed.save()
      }
      log.command.info(`Removing all embeds for ${feed.url}`, message.guild)

      return await message.channel.send(translate('commands.embed.removedAllEmbeds'))
    }

    if (property === 'resetAll') {
      feed.embeds.splice(selectedEmbedIndex, 1)
      log.command.info(`Embed resetting for ${feed.url}`, message.guild)
      await feed.save()
      return await message.channel.send(translate('commands.embed.removedEmbed', { link: feed.url }))
    }

    let updated = ''
    let reset = ''
    for (const prop in settings) {
      const propName = embedProperties[prop].name
      const userSetting = settings[prop]
      if (userSetting === 'reset') {
        if (!feed.embeds[selectedEmbedIndex] || !feed.embeds[selectedEmbedIndex][prop]) {
          reset += translate('commands.embed.resetNothing', { propName })
          continue
        }
        delete feed.embeds[selectedEmbedIndex][prop]
        if (feed.text === '{empty}') {
          feed.text = undefined
        }

        log.command.info(`Property '${prop}' resetting for ${feed.url}`, message.guild)
        reset += translate('commands.embed.resetSuccess', { propName })
        continue
      }
      if (!feed.embeds[selectedEmbedIndex]) {
        feed.embeds.push({})
        log.command.info(`Adding new embed for ${feed.url}`, message.guild)
      }
      feed.embeds[selectedEmbedIndex][prop] = userSetting
      log.command.info(`Embed updating for ${feed.url}. Property '${prop}' set to '${userSetting}'`, message.guild)
      updated += translate('commands.embed.updatedSuccess', { propName, userSetting })
    }
    await feed.save()

    await message.channel.send(`${translate('commands.embed.updatedInfo', { link: feed.url, resetList: reset, updateList: updated, prefix })} ${translate('generics.backupReminder', { prefix })}`, { split: true })
  } catch (err) {
    log.command.warning(`rssembed`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssembed 1', message.guild, err))
  }
}
