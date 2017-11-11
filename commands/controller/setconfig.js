const fs = require('fs')
const config = require('../../config.json')
const Discord = require('discord.js')
const moment = require('moment-timezone')

function isNumber (configName, string) {
  const input = parseInt(string.split(' ')[2].trim(), 10)
  if (isNaN(input) || input < 0 || input % 1 !== 0) return 'That is not a valid number.'
  if (configName === 'menuColor' && input > 16777215) return '`menuColor` cannot be higher than 16777215.'
  return true
}

function isBool (configName, string) {
  const input = string.split(' ')[2].trim()
  if (input !== 'true' && input !== 'false') return 'That is not a valid boolean, must be either true or false.'
  return true
}

function isValidTimezone (configName, string) {
  const input = string.split(' ')[2].trim()
  if (!moment.tz.zone(input)) return 'That is not a valid timezone.'
  return true
}

function checkControllerIds (configName, string) {
  const input = string.split(' ')
  if (input.length !== 4 || (input[2] !== 'add' && input[2] !== 'remove')) return `Incorrect usage. Proper syntax is \`${config.botSettings.prefix}setconfig controllerids <add/remove> <id>\`.`
  if (isNaN(input[3])) return 'That is an invalid ID - not an integer.'
  return true
}

const validConfig = {
  'LOGGING': {
    showLinkErrs: {
      type: 'boolean',
      desc: 'Log connection failures on requests to feed URLs. Default is `true`.',
      checkValid: isBool
    },
    showUnfiltered: {
      type: 'boolean',
      desc: 'Log article links/titles that weren\'t sent due to failing to pass specified filters. Default is `true`.',
      checkValid: isBool
    }
  },
  'BOT SETTINGS': {
    prefix: {
      type: 'string',
      desc: 'Prefix for Discord commands.'
    },
    menuColor: {
      type: 'number',
      desc: 'The color of the Discord embed menu commands, between 0 and 16777215. Must be an integer color. Default is `7833753`.',
      checkValid: isNumber
    },
    controllerIds: {
      type: 'array',
      desc: 'User IDs who have access to Bot Controller commands. Two arguments, `<add/remove> <id>`.',
      checkValid: checkControllerIds
    }
  },
  'FEED SETTINGS': {
    timezone: {
      type: 'string',
      desc: 'Only useful if {date} placeholder is used. By default the date will be in UTC if left blank. Must be from <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> under TZ column.',
      checkValid: isValidTimezone
    },
    timeFormat: {
      type: 'string',
      desc: 'Format how {date} is shown. See details at <http://momentjs.com/docs/#/displaying/format/>. Whatever is here, will be inside `.format(<timeFormat>)` Default is `ddd, D MMMM YYYY, h:mm A z`.'
    },
    maxFeeds: {
      type: 'number',
      desc: 'The maximum amount of feeds each server is allowed to have. Default is `0` (unlimited).',
      checkValid: isNumber
    },
    defaultMaxAge: {
      type: 'number',
      desc: 'The max aged feed in days that the bot will send to Discord on startup if `sendOldMessages` is `true`. Default is `1`.',
      checkValid: isNumber
    },
    cycleMaxAge: {
      type: 'number',
      desc: 'The max aged feed in days that the bot will send to Discord during a cycle. Default is `1`.'
    },
    defaultMessage: {
      type: 'string',
      desc: 'If no custom message is defined for a specific feed, this will be the message the feed will fallback to.'
    }
  },
  'ADVANCED': {
    batchSize: {
      type: 'number',
      desc: 'Number of requests that must finish before proceeding to the next batch per retrieval cycle. Defaults is `400`.',
      checkValid: isNumber
    }
  }
}

function printConfigHelp () {
  const message = new Discord.RichEmbed()
  .setTitle('List of Confirgurable Configs')
  .setColor(config.botSettings.menuColor)
  .setDescription(`The syntax to change certain configs through is \`${config.botSettings.prefix}setconfig <config> <argument(s)>\`\n\u200b`)

  for (var category in validConfig) {
    let description = ''
    for (var configName in validConfig[category]) {
      description += `\n\n**${configName}** (${validConfig[category][configName].type})\n*${validConfig[category][configName].desc}*`
    }
    message.addField(category, description, true)
  }

  return message
}

exports.normal = function (bot, message) {
  const content = message.content.split(' ')
  if (content.length === 1) return message.channel.send({embed: printConfigHelp()})
  if (content.length === 2) return message.channel.send(`The proper syntax to change certain configs through is ${config.botSettings.prefix}setconfig <config> <argument(s)>.`)
  for (var category in validConfig) {
    for (var configName in validConfig[category]) {
      if (content[1] === configName) {
        let configObject = validConfig[category][configName]
        if (configObject.checkValid && configObject.checkValid(configName, message.content) !== true) return message.channel.send(configObject.checkValid(configName, message.content))
        var setting

        switch (configObject.type) { // Set the actual setting
          case 'number':
            setting = parseInt(content[2], 10)
            break
          case 'boolean':
            setting = content[2] === 'true'
            break
          case 'array':
            setting = config.botSettings.controllerIds
            if (content[2] === 'add') setting.push(content[3])
            else if (content[2] === 'remove') {
              let found = false
              for (var index in setting) {
                if (setting[index] === content[3]) {
                  found = true
                  setting.splice(index, 1)
                }
              }
              if (!found) {
                setting = null
                message.channel.send('No such controller ID exists to be removed.')
              }
            }
            break

          case 'string':
            setting = content[2]
        }

        if (setting == null) return
        let categoryName = ''

        switch (category) { // Set the category to proper case according to config.json
          case 'ADVANCED':
          case 'LOGGING':
            categoryName = category.toLowerCase()
            break
          case 'FEED SETTINGS':
            categoryName = 'feedSettings'
            break
          case 'BOT SETTINGS':
            categoryName = 'botSettings'
        }

        if (!config[categoryName]) config[categoryName] = {}
        config[categoryName][configName] = setting

        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))
        console.log(`Bot Controller: Config '${configName}' value has been changed to to '${setting}' by (${message.author.id}, ${message.author.username}).`)
        delete require.cache[require.resolve('../../config.json')]
        // if (bot.shard) {
        //   bot.shard.broadcastEval(`
        //     const appDir = require('path').dirname(require.main.filename);
        //     let config = require(appDir + '/config.json');
        //     config = JSON.parse('${JSON.stringify(config)}');
        //     delete require.cache[appDir + '\\config.json'];
        //   `).catch(err => console.info(err.message || err))
        // }
        return message.channel.send(`Config \`${configName}\` has been set to \`${setting}\`.`)
      }
    }
  }

  message.channel.send('No such config exists.')
}

exports.sharded = function (bot, message) {
  message.channel.send('Not yet supported for sharding.')
}
