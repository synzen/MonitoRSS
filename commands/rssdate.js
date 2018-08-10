const config = require('../config.json')
const moment = require('moment-timezone')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const dbOps = require('../util/dbOps.js')
const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')

// // To avoid stack call exceeded
// function checkObjType (item, results) {
//   if (Object.prototype.toString.call(item) === '[object Object]') {
//     return function () {
//       return findDatePlaceholders(item, results)
//     }
//   } else if (typeof item === 'string' && item.search(/{date}/) !== -1) results.push(true)
// }

// // Used to find {date} in any object values
// function findDatePlaceholders (obj, results) {
//   for (var key in obj) {
//     let value = checkObjType(obj[key], results)
//     while (typeof value === 'function') {
//       value = value()
//     }
//   }
// }

function selectOption (m, data, callback) {
  const input = m.content
  const num = parseInt(input, 10)

  if (isNaN(num) || num <= 0 || num > 4) return callback(new SyntaxError(`That is not a valid option. Try again, or type \`exit\` to cancel.`))

  if (num === 4) return callback(null, { num: num }, true)

  // Message collector for options 1, 2 and 3
  let desc = ''
  let locales = []
  let localesList = ''
  if (num === 3) {
    locales = moment.locales()
    localesList = locales.join(', ')
    desc = `Type the abbreviation for a new language now, \`reset\` to reset back to default, or \`exit\` to cancel. The available list of languages supported at this time are (separated by commas):\n\n${localesList}`
  } else if (num === 2) desc = `Type your new date format now, \`reset\` to reset back to default, or \`exit\` to cancel. See <https://momentjs.com/docs/#/displaying/> on how to format a date.`
  else if (num === 1) desc = `Type your new timezone now, \`reset\` to reset back to default, or \`exit\` to cancel. See <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for a list of timezones under the TZ column.`

  callback(null, { ...data,
    num: num,
    locales: locales,
    localesList: localesList,
    next: {
      text: desc,
      embed: null
    }})
}

function setOption (m, data, callback) {
  const { num, locales, localesList } = data
  const input = m.content
  const inputLow = input.toLowerCase()

  const settingName = num === 3 ? 'Date language' : num === 2 ? 'Date format' : 'Timezone'

  if (inputLow === 'reset') return callback(null, { ...data, settingName: settingName, setting: input })

  if (num === 3) {
    if (!locales.includes(input)) return callback(new SyntaxError(`\`${input}\` is not a supported language abbreviation. The available languages are:\n\n${localesList}\n\nTry again, or type \`exit\` to cancel.`))
    return callback(null, { ...data, settingName: settingName, setting: input })
  } else if (num === 2) {
    return callback(null, { ...data, settingName: settingName, setting: input })
  } else if (num === 1) {
    if (!moment.tz.zone(input)) return callback(new SyntaxError(`\`${input}\` is not a valid timezone. See <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for more information. Valid timezones are in the \`TZ\` column. Try again, or type \`exit\` to cancel.`))
    return callback(null, { ...data, settingName: settingName, setting: input })
  }
}

module.exports = (bot, message) => {
  const guildRss = currentGuilds.get(message.guild.id)
  // if (!guildRss || !guildRss.sources || Object.keys(guildRss.sources).length === 0) return message.channel.send('You cannot customize the date placeholder if you have not added any feeds.').catch(err => log.command.warning(`rssdate 1:`, message.guild, err))

  // let results = []
  // findDatePlaceholders(guildRss.sources, results)
  // if (results.length === 0) return message.channel.send('You cannot customize the date placeholder if you don\'t use the `{date}` placeholder in any of your feeds.').catch(err => log.command.warning(`rssdate 2`, message.guild, err))

  const select = new MenuUtils.Menu(message, selectOption).setAuthor('Date Customizations')
    .setDescription('\u200b\nPlease select an option to customize the {date} placeholder by typing its number, or type **exit** to cancel.\u200b\n\u200b\n')
    .addOption('Change Timezone', `Default is \`${config.feeds.timezone}\`.${guildRss.timezone ? ' Your current setting is `' + guildRss.timezone + '`.' : ''}`)
    .addOption('Customize Format', `Default is \`${config.feeds.dateFormat}\`. Customize the formatting of the date.${guildRss.dateFormat ? ' Your current setting is `' + guildRss.dateFormat + '`.' : ''}`)
    .addOption('Change Language', `Default is \`${config.feeds.dateLanguage}\`. Change the language of the date.${guildRss.dateLanguage ? ' Your current setting is `' + guildRss.dateLanguage + '`.' : ''}`)
    .addOption('Reset', `Reset all of the above back to default.`)

  const set = new MenuUtils.Menu(message, setOption)

  new MenuUtils.MenuSeries(message, [select, set], { guildRss: guildRss }).start(async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const { num, settingName, setting } = data

      if (num === 4) {
        guildRss.timezone = undefined
        guildRss.dateFormat = undefined
        guildRss.dateLanguage = undefined
        log.command.info(`Date settings reset to default`, message.guild)
        dbOps.guildRss.update(guildRss)
        return await message.channel.send(`All date customizations have been reset back to default.`)
      }

      if (setting.toLowerCase() === 'reset') {
        if (num === 3) guildRss.dateLanguage = undefined
        else if (num === 2) guildRss.dateFormat = undefined
        else guildRss.timezone = undefined

        await message.channel.send(`${settingName} has been reset to the default: \`${config.feeds[num === 3 ? 'dateLanguage' : num === 2 ? 'dateFormat' : 'timezone']}\`.`)
        log.command.info(`Date setting ${settingName} reset to default`, message.guild)
        dbOps.guildRss.update(guildRss)
      } else {
        if (num === 3) guildRss.dateLanguage = setting.toLowerCase() === config.feeds.dateLanguage.toLowerCase() ? undefined : setting
        else if (num === 2) guildRss.dateFormat = setting.toLowerCase() === config.feeds.dateFormat ? undefined : setting
        else if (num === 1) guildRss.timezone = setting.toLowerCase() === config.feeds.timezone.toLowerCase() ? undefined : setting

        log.command.info(`Date setting ${settingName} updated to '${setting}'`, message.guild)
        dbOps.guildRss.update(guildRss)
        await message.channel.send(`${settingName} has been successfully updated to \`${setting}\`.`)
      }
    } catch (err) {
      log.command.warning(`rssdate`, message.guild, err)
    }
  })
}
