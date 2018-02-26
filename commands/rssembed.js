const fileOps = require('../util/fileOps.js')
const config = require('../config.json')
const MenuUtils = require('./util/MenuUtils.js')
const FeedSelector = require('./util/FeedSelector.js')
const log = require('../util/logger.js')
const EMBED_PROPERTIES = {
  color: { name: 'Color', description: 'Sidebar color\nMUST be an integer color between 0 and 16777215. See https://www.shodor.org/stella2java/rgbint.html' },
  authorTitle: { name: 'Author Title', description: 'Title at the top\nAccepts placeholders' },
  authorAvatarURL: { name: 'Author Avatar URL', description: 'Avatar icon to the left of Author Title\nMUST be a link to an image. If Author Title is unspecified, the Author Avatar will be hidden' },
  title: { name: 'Title', description: 'Title under Author Title\nAccepts placeholders' },
  imageURL: { name: 'Image URL', description: 'Image on the bottom\nMUST be a link to an image, OR an {imageX} placeholder' },
  thumbnailURL: { name: 'Thumbnail Image URL', description: 'Image on the right side\nMUST be a link to an image, OR an {imageX} placeholder' },
  message: { name: 'Message', description: 'Main message\nAccepts placeholders' },
  footerText: { name: 'Footer Text', description: 'Bottom-most text\nAccepts placeholders' },
  footerIconURL: { name: 'Footer Icon URL', description: 'Icon to the left of Footer Text\nMUST be a link to an image. If Footer Text is unspecified, the Footer Icon will be hidden\nAccepts placeholders' },
  url: { name: 'URL', description: 'Clicking on the Title/Thumbnail will lead to this URL\nMUST be a link. Set to the article\'s url by default' }
}

let EMBED_PROPERTIES_LIST = '```Markdown\n'
for (var pn in EMBED_PROPERTIES) {
  const cur = EMBED_PROPERTIES[pn]
  EMBED_PROPERTIES_LIST += `[${cur.name}]: ${cur.description}\n\n${pn === 'url' ? '```' : ''}`
}

function validURL (input) { // A simple check is enough
  return input.startsWith('http://') || input.startsWith('https://') || input === '{link}'
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

  let currentEmbedProps = '```Markdown\n'
  if (source.embedMessage && source.embedMessage.properties) {
    const propertyList = source.embedMessage.properties
    for (var property in propertyList) {
      for (var p in EMBED_PROPERTIES) {
        if (p === property && propertyList[property]) currentEmbedProps += `[${EMBED_PROPERTIES[p].name}]: ${propertyList[property]}\n`
      }
    }
  }

  if (currentEmbedProps === '```Markdown\n') currentEmbedProps = '```\nNo properties set.\n'

  callback(null, { ...data,
    next: {
      text: `The current embed properties for ${source.link} are: \n${currentEmbedProps + '```'}\nThe available properties are: ${EMBED_PROPERTIES_LIST}\n**Type the embed property (shown in brackets [property]) you want to set/reset**, or multiple properties by separation with commas. Type \`reset\` to disable and remove all properties, or type \`exit\` to cancel.`,
      embed: null }
  })
}

function selectProperty (m, data, callback) {
  const input = m.content.toLowerCase()
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
    text: `Set the **${EMBED_PROPERTIES[choices[0]].name}** now. To reset the property, type \`reset\`.\n\nRemember that you can use placeholders \`{title}\`, \`{description}\`, \`{link}\`, and etc. in the correct fields. Regular formatting such as **bold** and etc. is also available. To find other placeholders, you may first type \`exit\` then use \`${config.botSettings.prefix}rsstest\`.`,
    menu: setMenus
  }
  callback(null, { ...data,
    properties: choices,
    settings: {}
  })
}

function setProperty (m, data, callback) {
  const { properties } = data
  const property = properties.shift()
  const setting = m.content.trim()
  data.next = {
    text: `Set the **${properties[0] ? EMBED_PROPERTIES[properties[0]].name : ''}** now. To reset the property, type \`reset\`.`
  }

  if (setting.toLowerCase() === 'reset') {
    data.settings[property] = 'reset'
    return callback(null, data)
  }
  const valid = validate(property, setting)
  if (valid === true) data.settings[property] = setting
  else return callback(new SyntaxError(valid))
  callback(null, data)
}

module.exports = (bot, message, command) => {
  const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command })
  const selectProp = new MenuUtils.Menu(message, selectProperty)
  // const setProp = new MenuUtils.Menu(message, setProperty)
  new MenuUtils.MenuSeries(message, [feedSelector, selectProp]).start(async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const { guildRss, rssName, property, settings } = data
      const source = guildRss.sources[rssName]

      if (property === 'resetAll') {
        const resetting = await message.channel.send(`Resetting and disabling embed...`)
        delete source.embedMessage
        if (source.message === '{empty}') delete source.message // An empty message is not allowed if there is no embed
        fileOps.updateFile(guildRss)
        log.command.info(`Embed reset for ${source.link}`, message.guild)
        return await resetting.edit(`Embed has been disabled, and all properties have been removed for <${source.link}>.`)
      }

      let status = ''
      let reset = ''
      const updating = await message.channel.send('Updating settings...')
      for (var prop in settings) {
        const propName = EMBED_PROPERTIES[prop].name
        const setting = settings[prop]
        if (setting === 'reset') {
          if (!source.embedMessage || !source.embedMessage.properties || !source.embedMessage.properties[prop]) {
            reset += `🇽 **${propName}** has nothing to reset\n`
            continue
          }
          delete source.embedMessage.properties[prop]
          if (Object.keys(source.embedMessage.properties).length === 0) {
            delete source.embedMessage
            if (source.message === '{empty}') delete source.message // An empty message is not allowed if there is no embed
          }
          fileOps.updateFile(guildRss)
          log.command.info(`Property '${prop}' reset for ${source.link}`, message.guild)
          reset += `☑ **${propName}** has been reset\n`
          continue
        }
        if (typeof source.embedMessage !== 'object' || typeof source.embedMessage.properties !== 'object') source.embedMessage = { properties: {} }
        source.embedMessage.properties[prop] = setting
        log.command.info(`Embed updated for ${source.link}. Property '${prop}' set to '${setting}'`, message.guild)
        status += `☑ **${propName}** updated to \n\`\`\`\n${setting}\n\`\`\`\n`
      }

      fileOps.updateFile(guildRss)
      await updating.edit(`Settings updated for <${source.link}>:\n\n${reset}${status}\nYou may use \`~rsstest\` or \`~rsstest simple\` to see your new embed format.`)
    } catch (err) {
      log.command.warning(`rssembed:`, message.guild, err)
    }
  })
}
