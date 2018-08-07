const dbOps = require('../util/dbOps.js')
const config = require('../config.json')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const log = require('../util/logger.js')
const URLS = ['{link}', '{guid}', '{reddit_direct}', '{reddit_author}']
const EMBED_PROPERTIES = {
  color: { name: 'Color', description: 'Sidebar color\nMUST be an integer color between 0 and 16777215. See https://www.shodor.org/stella2java/rgbint.html' },
  authorTitle: { name: 'Author Title', description: 'Title at the top\nAccepts placeholders' },
  authorURL: { name: 'Author URL', description: 'Clicking on the Author Title will lead to this URL\nMUST be a link' },
  authorAvatarURL: { name: 'Author Avatar URL', description: 'Avatar icon to the left of Author Title\nMUST be a link to an image. If Author Title is unspecified, the Author Avatar will be hidden' },
  title: { name: 'Title', description: 'Title under Author Title\nAccepts placeholders' },
  thumbnailURL: { name: 'Thumbnail Image URL', description: 'Image on the right side\nMUST be a link to an image, OR an {imageX} placeholder' },
  url: { name: 'URL', description: 'Clicking on the Title/Thumbnail will lead to this URL\nMUST be a link. Set to the article\'s url by default' },
  imageURL: { name: 'Image URL', description: 'Image on the bottom\nMUST be a link to an image, OR an {imageX} placeholder' },
  message: { name: 'Message', description: 'Main message\nAccepts placeholders' },
  footerText: { name: 'Footer Text', description: 'Bottom-most text\nAccepts placeholders' },
  footerIconURL: { name: 'Footer Icon URL', description: 'Icon to the left of Footer Text\nMUST be a link to an image. If Footer Text is unspecified, the Footer Icon will be hidden\nAccepts placeholders' },
  timestamp: { name: 'Timestamp', description: 'Date that is visually localized to every user\nIf an invalid timestamp date is detected, timestamp will not be shown' }
}
const EMBED_PROPERTIES_KEYS = Object.keys(EMBED_PROPERTIES)
const EMBED_PROPERTIES_KEYS_LEN = EMBED_PROPERTIES_KEYS.length

let EMBED_PROPERTIES_LIST = '```Markdown\n# Available Properties #\n\n'
for (var pn in EMBED_PROPERTIES) {
  const cur = EMBED_PROPERTIES[pn]
  EMBED_PROPERTIES_LIST += `[${cur.name}]: ${cur.description}\n\n${pn === EMBED_PROPERTIES_KEYS[EMBED_PROPERTIES_KEYS_LEN - 1] ? '```' : ''}`
}

function validURL (input) { // A simple check is enough
  return input.startsWith('http://') || input.startsWith('https://') || URLS.includes(input) || validImg(input)
}

function validate (prop, setting) {
  const lprop = prop.toLowerCase()
  switch (lprop) {
    case 'color':
      return isNaN(parseInt(setting, 10)) ? 'The color must be an **number**. See <https://www.shodor.org/stella2java/rgbint.html>. Try again, or type `exit` to cancel.' : parseInt(setting, 10) < 0 || parseInt(setting, 10) > 16777215 ? 'The color must be a number between 0 and 16777215. Try again, or type `exit` to cancel.' : true
    case 'thumbnailURL':
    case 'authorAvatarURL':
    case 'imageURL':
    case 'footerIconURL':
      return validImg(setting) ? true : 'URLs must link to actual images or be `{imageX}` placeholders. Try again, or type `exit` to cancel.'
    case 'authorURL':
    case 'url':
      return validURL(setting) ? true : 'URLs must be links or the {link} placeholder. Try again, or type `exit` to cancel.'
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

function feedSelectorFn (m, data, callback) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]

  let currentEmbedProps = '```Markdown\n# Current Properties #\n\n'
  let changed = false
  if (source.embedMessage && source.embedMessage.properties) {
    const propertyList = source.embedMessage.properties
    for (var property in propertyList) {
      for (var p in EMBED_PROPERTIES) {
        if (p === property && propertyList[property]) {
          currentEmbedProps += `[${EMBED_PROPERTIES[p].name}]: ${propertyList[property]}\n\n`
          changed = true
        }
      }
    }
  }

  if (!changed) currentEmbedProps = '```\nNo properties set.\n'
  const m1 = `The current embed properties for ${source.link} are: \n${currentEmbedProps + '```'}\n`
  const m2 = `The list of embed properties that can be set are:\n${EMBED_PROPERTIES_LIST}\nType the embed property (for example, \`color\` or \`message\`) you want to set/reset, or multiple properties by separation with commas (for example, \`color, message\`). Type \`reset\` to remove all properties, or type \`exit\` to cancel.`
  let mFull
  mFull = (m1 + m2).length < 1995 ? `${m1}\n${m2}` : [m1, m2] // Separate into two messages if it exceeds Discord's max length of 2000
  callback(null, { ...data,
    next: {
      text: mFull,
      embed: null }
  })
}

function selectProperty (m, data, callback) {
  const input = m.content
  if (input === 'reset') return callback(null, { ...data, property: 'resetAll' }, true)
  const choices = []
  const arr = input.split(',').map(item => item.trim()).filter((item, index, self) => item && index === self.indexOf(item)) // Trim items, remove empty elements and remove duplicates
  const invalids = []
  for (var q = 0; q < arr.length; ++q) {
    const pChoice = arr[q].toLowerCase()
    let valid = false
    for (var p in EMBED_PROPERTIES) {
      if (pChoice === EMBED_PROPERTIES[p].name.toLowerCase()) {
        valid = true
        choices.push(p)
      }
    }
    if (!valid) invalids.push(arr[q])
  }

  if (invalids.length > 0) return callback(new SyntaxError(`The ${invalids.length === 1 ? 'property' : 'following properties'} \`${invalids.join('`,`')}\` ${invalids.length === 1 ? 'is' : 'are'} invalid. Try again, or type \`exit\` to cancel.`))
  if (choices.length === 0) return callback(new SyntaxError(`No valid properties selected. Try again, or type \`exit\` to cancel.`))
  const setMenus = []
  for (var x = 0; x < choices.length; ++x) setMenus.push(new MenuUtils.Menu(m, setProperty))

  data.next = {
    text: `You are now customizing the **${EMBED_PROPERTIES[choices[0]].name}**. Type your input now.\n\n${choices[0] !== 'timestamp' ? '' : `To set the timestamp to the time the article is sent to Discord, type \`now\`.\nTo set the timestamp to the time the article was published (if available in the feed), type \`article\`. \nFor a custom timestamp, type the text representation of a custom date (see <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse>).\n\n`}To reset the property, type \`reset\`.\n\nRemember that you can use placeholders \`{title}\`, \`{description}\`, \`{link}\`, and etc. in the correct fields. Regular formatting such as **bold** and etc. is also available. To find other placeholders, you may first type \`exit\` then use \`${config.bot.prefix}rsstest\`.`,
    menu: setMenus
  }
  callback(null, { ...data,
    properties: choices,
    settings: {}
  })
}

function setProperty (m, data, callback) {
  const { properties } = data
  const property = properties[0]
  const userSetting = m.content.trim()
  if (properties[1]) {
    data.next = {
      text: properties[1] !== 'timestamp' ? `You are now customizing the **${EMBED_PROPERTIES[properties[1]].name}**. Type your input now. To reset the property, type \`reset\`.` : `You are now customizing the **${EMBED_PROPERTIES[properties[1]].name}**.\n\nTo set the timestamp to the time the article is sent to Discord, type \`now\`.\nTo set the timestamp to the time the article was published (if available in the feed), type \`article\`.\nFor a custom timestamp, type the text representation of a custom date (see <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse>).\n\nTo reset the property, type \`reset\`.`
    }
  }

  if (userSetting.toLowerCase() === 'reset') {
    data.settings[property] = 'reset'
    properties.shift()
    return callback(null, data)
  }

  if (property === 'timestamp') {
    if (userSetting !== 'now' && userSetting !== 'article' && new Date(userSetting).toString() === 'Invalid Date') return callback(new SyntaxError('That is not a valid setting. It must be either `now`, `article`, or a valid text representation of a date. Try again.'))
    data.settings[property] = userSetting
    properties.shift()
    return callback(null, data)
  }

  const valid = validate(property, userSetting)
  if (valid === true) data.settings[property] = userSetting
  else return callback(new SyntaxError(valid))
  properties.shift()
  callback(null, data)
}

function fieldAction (m, data, callback) {
  const { guildRss, rssName } = data
  const input = parseInt(m.content, 10)
  if (isNaN(input) || input < 1 || input > 5) return new SyntaxError('That is not a valid option. Try again, or type `exit` to cancel.')
  const source = guildRss.sources[rssName]

  if (input === 5) {
    if (!source.embedMessage || !source.embedMessage.properties || !Array.isArray(source.embedMessage.properties.fields) || source.embedMessage.properties.fields.length === 0) {
      return callback(new Error('There are no embed fields to remove for this feed.'))
    }
    const fields = source.embedMessage.properties.fields
    const rmList = new MenuUtils.Menu(m, fieldRem)
      .setAuthor('Embed Fields Removal')
      .setDescription(`\u200b\nYour Fields are listed below, ordered by when they were added. Type the Field's number to remove it, or type multiple Field numbers separateed by commas (\`,\`). Type **exit** to cancel.\n\u200b`)

    for (var x = 0; x < fields.length; ++x) {
      const field = fields[x]
      const inline = field.inline === true ? '(Inline)' : '(Regular)'
      if (!field.title && typeof field.title === 'string') rmList.addOption(`${inline} Blank Field`, '\u200b')
      else rmList.addOption(`${inline} ${field.title}`, field.value)
    }

    callback(null, { ...data, next: { menu: rmList } })
  } else {
    if (source.embedMessage && source.embedMessage.properties && Array.isArray(source.embedMessage.properties.fields) && source.embedMessage.properties.fields.length === 10) return callback(new Error('You have reached the maximum number of fields you can add (10).'))

    if (input === 3 || input === 4) { // Non-inline blank field
      if (!source.embedMessage) source.embedMessage = { properties: { fields: [] } }
      if (!source.embedMessage.properties) source.embedMessage.properties = { fields: [] }
      if (!source.embedMessage.properties.fields) source.embedMessage.properties.fields = []
      source.embedMessage.properties.fields.push({ title: '' })
      return callback(null, { ...data, successText: `An blank Field has been added to the embed for the feed <${source.link}>.` })
    } else if (input === 4) { // Inline blank field
      if (!source.embedMessage) source.embedMessage = { properties: { fields: [] } }
      source.embedMessage.properties.fields.push({ title: '', inline: true })
      return callback(null, { ...data, successText: `An inline blank Field has been added to the embed for the feed <${source.link}>.` })
    }

    const specMenu = new MenuUtils.Menu(m, fieldAddSpec)
    callback(null, { ...data,
      selectedOption: input,
      next:
      { menu: specMenu,
        text: 'Set your Field settings now. The **first line will be the Field title**, and **any new lines after the first will be the Field description**. If there is no content after the first line, then it will be an empty description. Type `exit` to cancel.' }
    })
  }
}

function fieldAddSpec (m, data, callback) {
  const { guildRss, rssName, selectedOption } = data

  const arr = m.content.split('\n')
  while (!arr[0]) arr.shift()
  const title = arr.shift().trim()
  if (!title) return callback(new SyntaxError('No valid title found. Try again, or type `exit` to cancel.'))
  else if (title.length > 256) return callback(new SyntaxError('Titles cannot exceed 256 characters. Try again, or type `exit` to cancel.'))
  const val = arr.join('\n').trim()
  if (val.length > 1024) return callback(new SyntaxError('Field values cannot exceed 1024 characters. Try again, or type `exit` to cancel.'))
  const setting = { title: title, value: val || '\u200b' }
  if (selectedOption === 2) setting.inline = true

  const source = guildRss.sources[rssName]
  if (!source.embedMessage) source.embedMessage = { properties: { fields: [] } }
  else if (!source.embedMessage.properties) source.embedMessage.properties = { fields: [] }
  else if (!source.embedMessage.properties.fields) source.embedMessage.properties.fields = []
  const embedFields = guildRss.sources[rssName].embedMessage.properties.fields

  log.command.info(`Embed field added. Title: '${title}', Value: ${val}`, m.guild)

  embedFields.push(setting)
  callback(null, { ...data,
    successText: `A new${selectedOption === 2 ? ' inline' : ''} Field has been added to the embed with the following details:\n\n**Title**
\`\`\`
${title}
\`\`\`
**Value**
\`\`\`
${val && val.length > 1500 ? val.slice(0, 1500) + '...' : val || '\u200b'}
\`\`\`\n for the feed <${source.link}>.` })
}

function fieldRem (m, data, callback) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  const fields = source.embedMessage.properties.fields
  const inputs = m.content.split(',').map(item => item.trim()).filter((item, index, self) => {
    const num = parseInt(item, 10)
    return item && index === self.indexOf(item) && !isNaN(num) && num > 0 && num <= fields.length
  })
  if (inputs.length === 0) return callback(new SyntaxError('No valid Fields chosen. Try again, or type `exit` to cancel.'))

  for (var x = inputs.length; x >= 0; --x) {
    log.command.info(`Embed field removed`, m.guild)
    fields.splice(inputs[x] - 1, 1)
  }
  if (fields.length === 0) delete source.embedMessage.properties.fields
  if (Object.keys(source.embedMessage.properties).length === 0) delete source.embedMessage.properties
  if (Object.keys(source.embedMessage).length === 0) delete source.embedMessage
  callback(null, { ...data, successText: `The Field(s) numbered ${inputs.join(', ')} have been removed from the embed for the feed <${source.link}>.` })
}

module.exports = (bot, message, command) => {
  const setFields = message.content.split(' ')[1] === 'fields'
  const feedSelectorField = new FeedSelector(message, null, { command: command })
  const fieldActionMenu = new MenuUtils.Menu(message, fieldAction)
    .setAuthor('Embed Fields')
    .setDescription('\u200b\nSelect whether to add or remove a field from this feed\'s embed. For an example of what a field looks like, see https://i.imgur.com/WSHwmyB.png. Type **exit** to cancel.\n\u200b')
    .addOption('Add a regular Field', 'This is the "regular" type of field. All fields will be stacked on top of each other.')
    .addOption('Add an inline Field', 'Fields will be able to be placed beside each other whenever possible rather than being stacked.')
    .addOption('Add a regular Blank Field', 'A blank field that contains no title or description. This is used to take up empty space.')
    .addOption('Add a inline Blank Field', 'A Blank Field, but inline.')
    .addOption('Remove a Field', 'Remove a Field if it exists.')

  // Fields
  if (setFields) {
    return new MenuUtils.MenuSeries(message, [feedSelectorField, fieldActionMenu]).start(async (err, data) => {
      try {
        if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
        const { guildRss, successText } = data
        dbOps.guildRss.update(guildRss)
        await message.channel.send(successText)
      } catch (err) {
        log.command.warning(`rssembed fields`, message.guild, err)
      }
    })
  }

  // Regular properties
  const feedSelectorProp = new FeedSelector(message, feedSelectorFn, { command: command })
  const selectProp = new MenuUtils.Menu(message, selectProperty)

  new MenuUtils.MenuSeries(message, [feedSelectorProp, selectProp]).start(async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const { guildRss, rssName, property, settings } = data
      const source = guildRss.sources[rssName]

      if (property === 'resetAll') {
        const resetting = await message.channel.send(`Resetting and disabling embed...`)
        delete source.embedMessage
        if (source.message === '{empty}') delete source.message // An empty message is not allowed if there is no embed
        dbOps.guildRss.update(guildRss)
        log.command.info(`Embed reset for ${source.link}`, message.guild)
        return await resetting.edit(`Embed has been disabled, and all properties have been removed for <${source.link}>.`)
      }

      let status = ''
      let reset = ''
      for (var prop in settings) {
        const propName = EMBED_PROPERTIES[prop].name
        const userSetting = settings[prop]
        if (userSetting === 'reset') {
          if (!source.embedMessage || !source.embedMessage.properties || !source.embedMessage.properties[prop]) {
            reset += `🇽 **${propName}** has nothing to reset\n`
            continue
          }
          delete source.embedMessage.properties[prop]
          if (Object.keys(source.embedMessage.properties).length === 0) {
            delete source.embedMessage
            if (source.message === '{empty}') delete source.message // An empty message is not allowed if there is no embed
          }
          dbOps.guildRss.update(guildRss)
          log.command.info(`Property '${prop}' reset for ${source.link}`, message.guild)
          reset += `☑ **${propName}** has been reset\n`
          continue
        }
        if (typeof source.embedMessage !== 'object' || typeof source.embedMessage.properties !== 'object') source.embedMessage = { properties: {} }
        source.embedMessage.properties[prop] = userSetting
        log.command.info(`Embed updated for ${source.link}. Property '${prop}' set to '${userSetting}'`, message.guild)
        status += `☑ **${propName}** updated to \n\`\`\`\n${userSetting}\n\`\`\`\n`
      }

      dbOps.guildRss.update(guildRss)
      message.channel.send(`Settings updated for <${source.link}>:\n\n${reset}${status}\nYou may use \`~rsstest\` or \`~rsstest simple\` to see your new embed format. After completely setting up, it is recommended that you use ${config.bot.prefix}rssbackup to have a personal backup of your settings.`, { split: true })
    } catch (err) {
      log.command.warning(`rssembed`, message.guild, err)
    }
  })
}
