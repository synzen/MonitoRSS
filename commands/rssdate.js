const channelTracker = require('../util/channelTracker.js')
const config = require('../config.json')
const moment = require('moment-timezone')
const storage = require('../util/storage.js')
const fileOps = require('../util/fileOps.js')
const Discord = require('discord.js')
const MsgHandler = require('../util/MsgHandler.js')

// To avoid stack call exceeded
function checkObjType (item, results) {
  if (Object.prototype.toString.call(item) === '[object Object]') {
    return function () {
      return findDatePlaceholders(item, results)
    }
  } else if (typeof item === 'string' && item.search(/{date}/) !== -1) results.push(true)
}

// Used to find {date} in any object values
function findDatePlaceholders (obj, results) {
  for (var key in obj) {
    let value = checkObjType(obj[key], results)
    while (typeof value === 'function') {
      value = value()
    }
  }
}

module.exports = (bot, message) => {
  const currentGuilds = storage.currentGuilds
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.send('You cannot customize the date placeholder if you have not added any feeds.').catch(err => console.log(`Commands Warning: rssdate 1:`, err))

  let results = []
  findDatePlaceholders(guildRss.sources, results)
  if (results.length === 0) return message.channel.send('You cannot customize the date placeholder if you don\'t use the `{date}` placeholder in any of your feeds.').catch(err => console.log(`Commands Warning: rssdate 2:`, err))

  const menu = new Discord.RichEmbed()
    .setColor(config.botSettings.menuColor)
    .setAuthor('Date Customizations')
    .setDescription('\u200b\nPlease select an option to customize the {date} placeholder by typing its number, or type **exit** to cancel.\u200b\n\u200b\n')
    .addField('1) Change Timezone', `Default is \`${config.feedSettings.timezone}\`.${guildRss.timezone ? ' Your current setting is `' + guildRss.timezone + '`.': ''}`)
    .addField('2) Customize Format', `Default is \`${config.feedSettings.dateFormat}\`. Customize the formatting of the date.${guildRss.dateFormat ? ' Your current setting is `' + guildRss.dateFormat + '`.': ''}`)
    .addField('3) Change Language', `Default is \`${config.feedSettings.dateLanguage}\`. Change the language of the date.${guildRss.dateLanguage ? ' Your current setting is `' + guildRss.dateLanguage + '`.': ''}`)
    .addField('4) Reset', `Reset all of the above back to default.`)

  const firstMsgHandler = new MsgHandler(bot, message)

  message.channel.send({embed: menu})
  .then(msgPrompt => {
    firstMsgHandler.add(msgPrompt)
    const filter = m => m.author.id === message.author.id
    const collector = message.channel.createMessageCollector(filter, {time: 240000})
    channelTracker.add(message.channel.id)

    collector.on('collect', m => {
      firstMsgHandler.add(m)
      const resp = m.content
      if (resp.toLowerCase() === 'exit') return collector.stop(`Date Customizations menu closed.`)
      const num = parseInt(resp, 10)

      if (isNaN(num) || num <= 0 || num > 4) return message.channel.send(`That is not a valid option. Please try again, or type exit to cancel.`).then(m => firstMsgHandler.add(m))
      collector.stop()

      if (num === 4) {
        delete guildRss.timezone
        delete guildRss.dateFormat
        delete guildRss.dateLanguage
        message.channel.send(`All date customizations have been reset back to default.`).catch(err => console.log(`Commands Warning: rssdate 3:`, err))
        console.log(`RSS Date: (${message.guild.id}, ${message.guild.name}) => All reset to default`)
        return fileOps.updateFile(message.guild.id, guildRss)
      }

      // Message collector for options 1, 2 and 3
      let desc = ''
      let locales = []
      let localesList = ''
      if (num === 3) {
        locales = moment.locales()
        localesList = locales.join(', ')
        desc = `Type the abbreviation for a new language now, **reset** to reset back to default, or **exit** to cancel. The available list of languages supported at this time are (separated by commas):\n\n${localesList}`
      }
      else if (num === 2) desc = `Type your new date format now, **reset** to reset back to default, or **exit** to cancel. See <https://momentjs.com/docs/#/displaying/> on how to format a date.`
      else if (num === 1) desc = `Type your new timezone now, **reset** to reset back to default, or **exit** to cancel. See <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for a list of timezones under the TZ column.`
      message.channel.send(desc)
      .then(descrip => {
        firstMsgHandler.add(descrip)
        const filter = m => m.author.id === message.author.id
        const collectorTwo = message.channel.createMessageCollector(filter, {time: 240000})
        channelTracker.add(message.channel.id)


        collectorTwo.on('collect', m2 => {
          firstMsgHandler.add(m2)
          const secondResp = m2.content
          const secondRespLow = secondResp.toLowerCase()
          if (secondRespLow === 'exit') return collectorTwo.stop(`Date Customizations menu closed.`)

          const settingName = num === 3 ? 'Date language' : num === 2 ? 'Date format' : 'Timezone'

          if (secondRespLow === 'reset') {
            collectorTwo.stop()
            delete num === 3 ? guildRss.dateLanguage : num === 2 ? guildRss.dateFormat : guildRss.timezone
            message.channel.send(`${settingName} has been reset to the default: \`${config.feedSettings[num === 3 ? 'dateLanguage' : num === 2 ? 'dateFormat' : 'timezone']}\`.`).catch(err => console.log(`Commands Warning: rssdate 5:`, err))
            console.log(`RSS Date: (${message.guild.id}, ${message.guild.name}) => ${settingName} reset to default`)
            return fileOps.updateFile(message.guild.id, guildRss)
          }

          if (num === 3) {
            if (!locales.includes(secondResp)) return message.channel.send(`\`${secondResp}\` is not a supported language abbreviation. The available languages are:\n\n${localesList}\n\nTry again, or type exit to cancel.`).catch(err => console.log(`Commands Warning: rssdate 5b1:`, err))
            guildRss.dateLanguage = secondRespLow === config.feedSettings.dateLanguage.toLowerCase() ? undefined : secondResp

          }
          else if (num === 2) guildRss.dateFormat = secondResp === config.feedSettings.dateFormat ? undefined : secondResp
          else if (num === 1) {
            if (!moment.tz.zone(secondResp)) return message.channel.send(`\`${secondResp}\` is not a valid timezone. See <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> for more information. Valid timezones are in the \`TZ\` column. Try again, or type exit to cancel.`).catch(err => console.log(`Commands Warning: rssdate 5b2:`, err))
            guildRss.timezone = secondRespLow === config.feedSettings.timezone.toLowerCase() ? undefined : secondResp
          }

          collectorTwo.stop()
          message.channel.send(`${settingName} has been successfully updated to \`${secondResp}\`.`).catch(err => console.log(`Commands Warning: rssdate 6:`, err))
          console.log(`RSS Date: (${message.guild.id}, ${message.guild.name}) => ${settingName} updated to '${secondResp}.'`)
          fileOps.updateFile(message.guild.id, guildRss)
        })

        collectorTwo.on('end', (collected, reason) => {
          channelTracker.remove(message.channel.id)
          if (reason === 'user') return // Do not execute msgHandler.deleteAll if is user, since this means menu series proceeded to the next step and has not ended
          if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Commands Warning: Unable to send expired menu message (${err})`))
          else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000))
          firstMsgHandler.deleteAll(message.channel)
        })
      }).catch(err => console.log(`Commands Warning: rssdate 4:`, err))
    })

    collector.on('end', (collected, reason) => {
      channelTracker.remove(message.channel.id)
      if (reason === 'user') return // Do not execute msgHandler.deleteAll if is user, since this means menu series proceeded to the next step and has not ended
      if (reason === 'time') message.channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Commands Warning: Unable to send expired menu message (${err})`))
      else if (reason !== 'user') message.channel.send(reason).then(m => m.delete(6000))
      firstMsgHandler.deleteAll(message.channel)
    })

  }).catch(err => console.log(`Commands Warning: Could not send RSS Date menu:`, err))
}
