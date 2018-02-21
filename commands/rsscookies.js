const config = require('../config.json')
const storage = require('../util/storage.js')
const cookieAccessors = storage.cookieAccessors
const fileOps = require('../util/fileOps.js')
const MenuUtils = require('./util/MenuUtils.js')
const FeedSelector = require('./util/FeedSelector.js')

function feedSelectorFn (m, data, callback) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  let currentCookies = ''
  const cookieObj = (source.advanced && source.advanced.cookies && Object.keys(source.advanced.cookies).length > 0) ? source.advanced.cookies : undefined
  if (cookieObj) {
    for (var cookieKey in cookieObj) {
      currentCookies += `\n${cookieKey} = ${cookieObj[cookieKey]}`
    }
  }
  const msg = (currentCookies) ? `The current cookie(s) set for <${source.link}> is shown below.\`\`\`\n${currentCookies}\n\`\`\`` : `The current cookie(s) set for <${source.link}> is shown below.\`\`\`No cookies set.\`\`\``

  callback(null, { guildRss: guildRss,
    rssName: rssName,
    next: {
      text: msg + `\nType your new cookie(s) now with each one separated by a new line. Each cookie must have \`=\` between the key and its value. For example, \`cookieKey=myValue\`. Your current cookie(s) will be overwritten. To remove all cookies, type \`reset\`. To cancel, type \`exit\`.`,
      embed: null }
  })
}

function setNewCookies (m, data, callback) {
  const input = m.content

  if (input.toLowerCase() === 'reset') return callback(null, { ...data, setting: 'reset' })

  const cookieArray = input.split('\n')
  if (cookieArray.length === 0) return callback(new SyntaxError(`No valid cookies found. Please try again.`))

  callback(null, { ...data, setting: cookieArray })
}

module.exports = (bot, message, command) => {
  if (config.advanced && config.advanced.restrictCookies === true && !cookieAccessors.ids.includes(message.author.id)) return message.channel.send('You do not have access to cookie control.').then(m => m.delete(3500)).catch(err => console.log(`Commands Warning: Unable to send restricted access to rsscookies command:`, err.message || err))
  const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command })
  const cookiePrompt = new MenuUtils.Menu(message, setNewCookies)

  new MenuUtils.MenuSeries(message, [feedSelector, cookiePrompt]).start(async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const { guildRss, rssName, setting } = data
      const source = guildRss.sources[rssName]

      if (setting === 'reset') {
        delete source.advanced.cookies
        fileOps.updateFile(message.guild.id, guildRss)
        console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Cookies have been reset for ${source.link}.`)
        return await message.channel.send(`Successfully removed all cookies for feed ${source.link}`)
      }
      if (!source.advanced) source.advanced = {cookies: {}}
      else source.advanced.cookies = {}

      let newCookies = ''
      setting.forEach(item => { // Array
        const pair = item.split('=')
        if (pair.length === 2) source.advanced.cookies[pair[0].trim()] = pair[1].trim()
        newCookies += `\n${pair[0].trim()} = ${pair[1].trim()}`
      })

      fileOps.updateFile(message.guild.id, guildRss)

      console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Cookies for ${source.link} have been set to\n${newCookies}\n`)
      await message.channel.send(`Your new cookie(s) for <${source.link}> is now\n\`\`\`\n${newCookies}\`\`\``)
    } catch (err) {
      console.log(`Commands Warning: rsscookies:`, err.message || err)
    }
  })
}
