const fileOps = require('../util/fileOps.js')
const config = require('../config.json')
const MenuUtils = require('./util/MenuUtils.js')
const FeedSelector = require('./util/FeedSelector.js')
const log = require('../util/logger.js')
// EMBED_PROPERTIES where [0] = property name, [1] = property description, [2] = internal reference to property
const EMBED_PROPERTIES = [['Color', 'The sidebar color of the embed\nThis MUST be an integer color between 0 and 16777215. See https://www.shodor.org/stella2java/rgbint.html', 'color'],
                      ['Author Title', 'Title of the embed\nAccepts placeholders', 'authorTitle'],
                      ['Author URL', 'Clicking on the Atuhor Title will lead to this URL\nThis MUST be a link', 'authorURL'],
                      ['Author Avatar URL', 'The avatar icon to the left of Author Title\nThis MUST be a link to an image. If an Author Title is not specified, the Author Avatar will not be shown', 'authorAvatarURL'],
                      ['Title', 'Subtitle of the embed\nAccepts placeholders', 'title'],
                      ['Image URL', 'The main image on the bottom of the embed\nThis MUST be a link to an image, OR an {imageX} placeholder', 'imageURL'],
                      ['Thumbnail URL', 'The picture on the right hand side of the embed\nThis MUST be a link to an image, OR an {imageX} placeholder', 'thumbnailURL'],
                      ['Message', 'Main message of the embed\nAccepts placeholders', 'message'],
                      ['Footer Text', 'The bottom-most text\nAccepts placeholders', 'footerText'],
                      ['URL', 'Clicking on the Title/Thumbnail will lead to this URL\nThis MUST be a link. By default this is set to the feed\'s url', 'url']]
const EMBED_PROPERTIES_LIST = EMBED_PROPERTIES.reduce((acc, cur, i) => {
  acc += `[${cur[0]}]: ${cur[1]}\n\n${i === EMBED_PROPERTIES.length - 1 ? '```' : ''}`
  return acc
}, '```Markdown\n')

const imageFields = ['thumbnailURL', 'authorAvatarURL', 'imageURL']
const urlFields = ['authorURL', 'url']
function validURL (input) { // A simple check is enough
  return input.startsWith('http://') || input.startsWith('https://') || input === '{link}'
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
      EMBED_PROPERTIES.forEach(item => {
        if ((item[2] === property) && propertyList[property]) currentEmbedProps += `[${item[0]}]: ${propertyList[property]}\n`
      })
    }
  }

  if (currentEmbedProps === '```Markdown\n') currentEmbedProps = '```\nNo properties set.\n'

  callback(null, { ...data,
    next: {
      text: `The current embed properties for ${source.link} are: \n${currentEmbedProps + '```'}\nThe available properties are: ${EMBED_PROPERTIES_LIST}\n**Type the embed property (shown in brackets [property]) you want to set/reset**, type \`reset\` to disable and remove all properties, or type \`exit\` to cancel.`,
      embed: null }
  })
}

function selectProperty (m, data, callback) {
  let choice = ''
  const input = m.content
  EMBED_PROPERTIES.forEach(item => {
    if (input.toLowerCase() === item[0].toLowerCase()) choice = item[2]
  })

  if (input === 'reset') return callback(null, { ...data, property: 'resetAll' }, true)
  else if (!choice) return callback(new SyntaxError('That is not a valid property. Try again, or type `exit` to cancel.'))

  callback(null, { ...data,
    property: choice,
    next: {
      text: `Set the property now. To reset the property, type \`reset\`.\n\nRemember that you can use placeholders \`{title}\`, \`{description}\`, \`{link}\`, and etc. in the correct fields. Regular formatting such as **bold** and etc. is also available. To find other placeholders, you may first type \`exit\` then use \`${config.botSettings.prefix}rsstest\`.`
    }})
}

function setProperty (m, data, callback) {
  const { property } = data
  var setting = m.content.trim()
  if (setting.toLowerCase() === 'reset') return callback(null, { ...data, setting: 'reset' })
  if (property === 'color') {
    if (isNaN(parseInt(setting, 10))) return callback(new SyntaxError('The color must be an **number**. See <https://www.shodor.org/stella2java/rgbint.html>. Try again, or type `exit` to cancel.'))
    else if (parseInt(setting, 10) < 0 || parseInt(setting, 10) > 16777215) return callback(new SyntaxError('The color must be a number between 0 and 16777215. Try again, or type `exit` to cancel.'))
  }
  if (imageFields.includes(property) && !validImg(setting)) return callback(new SyntaxError('URLs must link to actual images or be `{imageX}` placeholders. Try again, or type `exit` to cancel.'))
  if (urlFields.includes(property) && !validURL(setting)) return callback(new SyntaxError('URLs must be links or the {link} placeholder. Try again, or type `exit` to cancel.'))
  if (property === 'attachURL' && !setting.startsWith('http')) return callback(new SyntaxError('URL option must be a link. Try again, or type `exit` to cancel.'))

  return callback(null, { ...data, setting: setting })
}

module.exports = (bot, message, command) => {
  const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command })
  const selectProp = new MenuUtils.Menu(message, selectProperty)
  const setProp = new MenuUtils.Menu(message, setProperty)
  new MenuUtils.MenuSeries(message, [feedSelector, selectProp, setProp]).start(async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const { guildRss, rssName, property, setting } = data
      const source = guildRss.sources[rssName]

      if (property === 'resetAll') {
        const resetting = await message.channel.send(`Resetting and disabling embed...`)
        delete source.embedMessage
        if (source.message === '{empty}') delete source.message // An empty message is not allowed if there is no embed
        fileOps.updateFile(guildRss)
        log.command.info(`Embed reset for ${source.link}`, message.guild)
        return await resetting.edit(`Embed has been disabled, and all properties have been removed for <${source.link}>.`)
      } else if (setting === 'reset') {
        const resetting = await message.channel.send(`Resetting property \`${property}\`...`)
        if (!source.embedMessage || !source.embedMessage.properties || !source.embedMessage.properties[property]) return await resetting.edit('This property has nothing to reset.')
        delete source.embedMessage.properties[property]
        if (Object.keys(source.embedMessage.properties).length === 0) {
          delete source.embedMessage
          if (source.message === '{empty}') delete source.message // An empty message is not allowed if there is no embed
        }
        fileOps.updateFile(guildRss)
        log.command.info(`Property '${property}' reset for ${source.link}`, message.guild)
        return await resetting.edit(`Settings updated. The property \`${property}\` has been reset for <${source.link}>.`)
      }

      const editing = await message.channel.send(`Updating embed settings...`)
      if (typeof source.embedMessage !== 'object' || typeof source.embedMessage.properties !== 'object') source.embedMessage = { properties: {} }
      source.embedMessage.properties[property] = setting
      log.command.info(`Embed updated for ${source.link}. Property '${property}' set to '${setting}'`, message.guild)
      fileOps.updateFile(guildRss)

      return await editing.edit(`Settings updated for <${source.link}>. The property \`${property}\` has been set to \`\`\`${setting}\`\`\`\nYou may use \`${config.botSettings.prefix}rsstest\` to see your new embed format.`)
    } catch (err) {
      log.command.warning(`rssembed:`, message.guild, err)
    }
  })
}
