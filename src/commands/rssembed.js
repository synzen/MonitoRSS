const dbOpsGuilds = require('../util/db/guilds.js')
const config = require('../config.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const log = require('../util/logger.js')
const Translator = require('../structs/Translator.js')
const getEmbedProperties = translate => ({
  title: { name: translate('commands.rssembed.title'), description: translate('commands.rssembed.titleDescription') },
  description: { name: translate('commands.rssembed.description'), description: translate('commands.rssembed.descriptionDescription') },
  url: { name: translate('commands.rssembed.url'), description: translate('commands.rssembed.urlDescription') },
  color: { name: translate('commands.rssembed.color'), description: translate('commands.rssembed.colorDescription') },
  timestamp: { name: translate('commands.rssembed.timestamp'), description: translate('commands.rssembed.timestampDescription') },
  footer_icon_url: { name: translate('commands.rssembed.footerIconURL'), description: translate('commands.rssembed.footerIconURLDescription') },
  footer_text: { name: translate('commands.rssembed.footerText'), description: translate('commands.rssembed.footerTextDescription') },
  thumbnail_url: { name: translate('commands.rssembed.thumbnailURL'), description: translate('commands.rssembed.thumbnailURLDescription') },
  image_url: { name: translate('commands.rssembed.imageURL'), description: translate('commands.rssembed.imageURLDescription') },
  author_name: { name: translate('commands.rssembed.authorName'), description: translate('commands.rssembed.authorNameDescription') },
  author_url: { name: translate('commands.rssembed.authorURL'), description: translate('commands.rssembed.authorURLDescription') },
  author_icon_url: { name: translate('commands.rssembed.authorIconURL'), description: translate('commands.rssembed.authorIconURLDescription') }
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
  const { guildRss, rssName, translate } = data
  const source = guildRss.sources[rssName]

  // Skip embed selection if there is no webhook
  if (!source.webhook) {
    if (!source.embeds) source.embeds = []
    return data.setFields ? generateFieldsMenu(m, { ...data, selectedEmbedIndex: 0 }) : generatePropertiesMessage(m, { ...data, selectedEmbedIndex: 0 })
  }

  const selectEmbed = new MenuUtils.Menu(m, selectEmbedFn)
    .setAuthor(translate('commands.rssembed.embedSelection'))
    .setDescription(translate('commands.rssembed.embedSelectionDescription'))
  if (source.embeds) {
    for (var x = 0; x < source.embeds.length; ++x) {
      const embed = source.embeds[x]
      if (!embed) continue
      let val = ''
      for (var prop in embed) {
        if (prop !== 'fields') val += `**${prop}:** ${embed[prop]}\n`
      }
      selectEmbed.addOption(x === 0 ? translate('commands.rssembed.defaultEmbed') : translate('commands.rssembed.numberedEmbed', { number: x + 1 }), `${val}\u200b`)
    }
  }
  if (!source.embeds || source.embeds.length < 10) {
    selectEmbed.addOption(translate('commands.rssembed.embedSelectionOptionAdd'), translate('commands.rssembed.embedSelectionOptionAddDescription'))
  }
  if (source.embeds && source.embeds.length > 0) {
    selectEmbed.addOption(translate('commands.rssembed.embedSelectionOptionRemoveAll'), `\u200b`)
  }
  return { ...data, next: { menu: selectEmbed } }
}

async function selectEmbedFn (m, data) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  const content = m.content
  const embedIndex = parseInt(content, 10) - 1

  // First condition is to add a new embed, second is to remove all embeds
  if (source.embeds && embedIndex !== source.embeds.length && embedIndex !== source.embeds.length + 1 && (!source.embeds || !source.embeds[embedIndex])) throw new Error('Menu closed due to invalid embed index selected.')
  if (embedIndex === 0 && !source.embeds) source.embeds = []
  const nextData = { ...data, selectedEmbedIndex: embedIndex }

  // Remove Embeds
  if (embedIndex === source.embeds.length + 1) {
    delete source.embeds
    return { ...data, removeAllEmbeds: true }
  }

  // Add an embed
  if (data.setFields) return generateFieldsMenu(m, nextData)
  return generatePropertiesMessage(m, nextData)
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
  const { guildRss, embedProperties, translate } = nextData
  const source = guildRss.sources[nextData.rssName]
  let currentEmbedProps = `\`\`\`Markdown\n# ${translate('commands.rssembed.currentProperties')} #\n\n`
  let changed = false
  const selectProp = new MenuUtils.Menu(m, selectProperty)
  const propertyList = source.embeds[nextData.selectedEmbedIndex]
  for (var property in propertyList) {
    for (var p in embedProperties) {
      if (p === property && propertyList[property]) {
        currentEmbedProps += `[${embedProperties[p].name}]: ${propertyList[property]}\n\n`
        changed = true
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
  const m1 = translate('commands.rssembed.currentPropertiesList', { link: source.link, list: currentEmbedProps })
  const m2 = translate('commands.rssembed.availablePropertiesList', { list: embedPropertiesListed })
  let mFull
  mFull = (m1 + m2).length < 1995 ? `${m1}\n${m2}` : [m1, m2] // Separate into two messages if it exceeds Discord's max length of 2000
  nextData.next = {
    text: mFull,
    menu: selectProp
  }
  return nextData
}

async function selectProperty (m, data) {
  const input = m.content
  const { embedProperties, translate } = data
  if (input === 'reset') return { ...data, property: 'resetAll' }
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
    if (!valid) invalids.push(arr[q])
  }

  if (invalids.length > 0) throw new MenuUtils.MenuOptionError(translate('commands.rssembed.invalidProperties', { invalids }))
  if (choices.length === 0) throw new MenuUtils.MenuOptionError(translate('commands.rssembed.noPropertiesSelected'))
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
    const { guildRss, rssName, selectedEmbedIndex, translate } = data
    const input = parseInt(m.content, 10)
    if (isNaN(input) || input < 1 || input > 5) return new MenuUtils.MenuOptionError()
    const source = guildRss.sources[rssName]

    if (input === 5) {
      // Remove a field
      if (!source.embeds[selectedEmbedIndex] || !Array.isArray(source.embeds[selectedEmbedIndex].fields) || source.embeds[selectedEmbedIndex].fields.length === 0) {
        throw new Error(translate('commands.rssembed.embedFieldsRemoveNone'))
      }
      const fields = source.embeds[selectedEmbedIndex].fields
      const rmList = new MenuUtils.Menu(m, fieldFunctions.remove)
        .setAuthor(translate('commands.rssembed.embedFieldsOptionRemoveEmbedTitle'))
        .setDescription(translate('commands.rssembed.embedFieldsOptionRemoveEmbedDescription'))

      for (const field of fields) {
        const inline = field.inline === true ? `(${translate('commands.rssembed.inline')})` : `(${translate('commands.rssembed.regular')})`
        if (!field.title && typeof field.title === 'string') {
          rmList.addOption(`${inline} ${translate('commands.rssembed.blankField')}`, '\u200b')
        } else {
          rmList.addOption(`${inline} ${field.title}`, field.value)
        }
      }

      return { ...data, next: { menu: rmList } }
    } else {
      // Add a field
      if (source.embeds[selectedEmbedIndex] && Array.isArray(source.embeds[selectedEmbedIndex].fields) && source.embeds[selectedEmbedIndex].fields.length === 10) {
        throw new Error(translate('commands.rssembed.embedFieldsMaximum'))
      }

      if (input === 3 || input === 4) {
        // Non-inline blank field
        if (!source.embeds) source.embeds = [ { fields: [] } ]
        if (!source.embeds[selectedEmbedIndex]) source.embeds.push({ fields: [] })
        if (!Array.isArray(source.embeds[selectedEmbedIndex].fields)) source.embeds[selectedEmbedIndex].fields = []
        source.embeds[selectedEmbedIndex].fields.push({ title: '' })
        return { ...data, successText: translate('commands.rssembed.embedFieldsAddedBlank', { link: source.link }) }
      } else if (input === 4) {
        // Inline blank field
        if (!source.embeds[selectedEmbedIndex]) source.embeds.push({ fields: [] })
        source.embeds[selectedEmbedIndex].fields.push({ title: '', inline: true })
        return { ...data, successText: translate('commands.rssembed.embedFieldsAddedBlankInline', { link: source.link }) }
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
    const { guildRss, rssName, selectedOption, selectedEmbedIndex, translate } = data
    const arr = m.content.split('\n')
    while (!arr[0]) arr.shift()
    const title = arr.shift().trim()
    if (!title) throw new MenuUtils.MenuOptionError(translate('commands.rssembed.embedFieldsSettingNoTitle'))
    else if (title.length > 256) throw new MenuUtils.MenuOptionError(translate('commands.rssembed.embedFieldsSettingTitleLong'))
    const val = arr.join('\n').trim()
    if (val.length > 1024) throw new MenuUtils.MenuOptionError(translate('commands.rssembed.embedFieldsSettingValueLong'))
    const setting = { title: title, value: val || '\u200b' }
    if (selectedOption === 2) setting.inline = true

    const source = guildRss.sources[rssName]
    if (!source.embeds) source.embeds = [{ fields: [] }]
    else if (!source.embeds[selectedEmbedIndex]) source.embeds.push({ fields: [] })
    else if (!source.embeds[selectedEmbedIndex].fields) source.embeds[selectedEmbedIndex].fields = []
    const embedFields = guildRss.sources[rssName].embeds[selectedEmbedIndex].fields

    log.command.info(`Embed field added. Title: '${title}', Value: '${val}'`, m.guild)

    embedFields.push(setting)
    return { ...data,
      successText: translate('commands.rssembed.embedFieldsAdded', {
        type: selectedOption === 2 ? ' inline' : '',
        title,
        value: val && val.length > 1500 ? val.slice(0, 1500) + '...' : val || '\u200b',
        link: source.link
      })
    }
  },
  remove: async (m, data) => {
    const { guildRss, rssName, selectedEmbedIndex, translate } = data
    const source = guildRss.sources[rssName]
    const fields = source.embeds[selectedEmbedIndex].fields
    const inputs = m.content.split(',').map(item => item.trim()).filter((item, index, self) => {
      const num = parseInt(item, 10)
      return item && index === self.indexOf(item) && !isNaN(num) && num > 0 && num <= fields.length
    })
    if (inputs.length === 0) throw new MenuUtils.MenuOptionError()

    for (var x = inputs.length; x >= 0; --x) {
      log.command.info(`Embed field removed`, m.guild)
      fields.splice(inputs[x] - 1, 1)
    }
    if (fields.length === 0) delete source.embeds[selectedEmbedIndex].fields
    if (Object.keys(source.embeds[selectedEmbedIndex]).length === 0) source.embeds.splice(selectedEmbedIndex, 1)
    if (source.embeds.length === 0) delete source.embeds
    return { ...data, successText: translate('commands.rssembed.embedFieldsRemoved', { numbers: inputs.join(', '), link: source.link }) }
  }
}

module.exports = async (bot, message, command) => {
  // Fields
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const guildLocale = guildRss ? guildRss.locale : null
    const translate = Translator.createLocaleTranslator(guildLocale)
    const embedProperties = getEmbedProperties(translate)
    const setFields = message.content.split(' ')[1] === 'fields'
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command }, guildRss)
    const prefix = guildRss.prefix || config.bot.prefix
    if (setFields) {
      const fieldsData = await new MenuUtils.MenuSeries(message, [feedSelector], { setFields, locale: guildLocale, embedProperties, translate }).start()
      if (!fieldsData) return
      const { rssName, successText, removeAllEmbeds } = fieldsData

      await dbOpsGuilds.update(guildRss)
      if (removeAllEmbeds) {
        log.command.info(`Removing all embeds for ${guildRss.sources[rssName].link}`, message.guild)
        return await message.channel.send(translate('commands.rssembed.removedAllEmbeds'))
      } else {
        log.command.info(`Updated embed fields for ${guildRss.sources[rssName].link}`, message.guild)
        return await message.channel.send(successText)
      }
    }

    // Regular properties
    const data = await new MenuUtils.MenuSeries(message, [feedSelector], { locale: guildLocale, embedProperties, translate }).start()
    if (!data) return
    const { rssName, property, settings, selectedEmbedIndex, removeAllEmbeds } = data

    if (removeAllEmbeds) {
      log.command.info(`Removing all embeds for ${guildRss.sources[rssName].link}`, message.guild)
      await dbOpsGuilds.update(guildRss)
      return await message.channel.send(translate('commands.rssembed.removedAllEmbeds'))
    }

    const source = guildRss.sources[rssName]

    if (property === 'resetAll') {
      source.embeds.splice(selectedEmbedIndex, 1)
      if (source.embeds.length === 0) delete source.embeds
      if (source.message === '{empty}') delete source.message // An empty message is not allowed if there is no embed
      log.command.info(`Embed resetting for ${source.link}`, message.guild)
      await dbOpsGuilds.update(guildRss)
      return await message.channel.send(translate('commands.rssembed.removedEmbed', { link: source.link }))
    }

    let updated = ''
    let reset = ''
    for (const prop in settings) {
      const propName = embedProperties[prop].name
      const userSetting = settings[prop]
      if (userSetting === 'reset') {
        if (!source.embeds || !source.embeds[selectedEmbedIndex] || !source.embeds[selectedEmbedIndex][prop]) {
          reset += translate('commands.rssembed.resetNothing', { propName })
          continue
        }
        delete source.embeds[selectedEmbedIndex][prop]
        if (Object.keys(source.embeds[selectedEmbedIndex]).length === 0) {
          source.embeds.splice(selectedEmbedIndex, 1)
          if (source.message === '{empty}') delete source.message // An empty message is not allowed if there is no embed
        }
        if (source.embeds.length === 0) delete source.embeds

        log.command.info(`Property '${prop}' resetting for ${source.link}`, message.guild)
        await dbOpsGuilds.update(guildRss)
        reset += translate('commands.rssembed.resetSuccess', { propName })
        continue
      }
      if (!Array.isArray(source.embeds)) source.embeds = []
      if (!source.embeds[selectedEmbedIndex]) {
        source.embeds.push({})
        log.command.info(`Adding new embed for ${source.link}`, message.guild)
      }
      source.embeds[selectedEmbedIndex][prop] = userSetting
      log.command.info(`Embed updating for ${source.link}. Property '${prop}' set to '${userSetting}'`, message.guild)
      updated += translate('commands.rssembed.updatedSuccess', { propName, userSetting })
    }

    await dbOpsGuilds.update(guildRss)
    await message.channel.send(`${translate('commands.rssembed.updatedInfo', { link: source.link, resetList: reset, updateList: updated, prefix })} ${translate('generics.backupReminder', { prefix })}`, { split: true })
  } catch (err) {
    log.command.warning(`rssembed`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssembed 1', message.guild, err))
  }
}
