const config = require('../../config.json')
const Discord = require('discord.js')
const util = require('util')
const moment = require('moment-timezone')
const guildStorage = require('../../util/guildStorage.js')
const currentGuilds = guildStorage.currentGuilds
const overriddenGuilds = guildStorage.overriddenGuilds
const fs = require('fs')
const fileOps = require('../../util/fileOps.js')

function isValidInt(configName, input) {
  const content = input.split(' ')
  input = parseInt(content[2], 10)
  if (isNaN(input) || input < 0 || input % 1 !== 0) return 'That is not a valid number.';
  if (configName === 'menuColor' && input > 16777215) return '`menuColor` cannot be higher than 16777215.';
  return true
}

function isBool(configName, input) {
  const content = input.split(' ')
  input = content[2]
  if (input != 1 && input != 0) return 'That is not a valid boolean, must be either 1 or 0.';
  return true
}

function isValidTimezone(configName, input) {
  const content = input.split(' ')
  input = content[2]
  if (!moment.tz.zone(input)) return 'That is not a valid timezone.';
  return true
}

function checkControllerIds(configName, input) {
  const content = input.split(' ')
  if (content.length !== 4 || (content[2] !== 'add' && content[2] !== 'remove')) return `Incorrect usage. Proper syntax is \`${config.botSettings.prefix}setconfig controllerids <add/remove> <id>\`.`;
  if (isNaN(content[3])) return 'That is an invalid ID - not an integer.';
  return true
}

const validConfig = {
  'LOGGING': {
    showFeedErrs: {
      type: 'bool',
      desc: 'Log connection failures on requests to feed URLs.',
      checkValid: isBool
    },
    showUnfiltered: {
      type: 'bool',
      desc: 'Log article links/titles that weren\'t sent due to failing to pass specified filters.',
      checkValid: isBool
    }
  },
  'BOT SETTINGS': {
    prefix: {
      type: 'string',
      desc: 'Prefix for Discord commands.'
    },
    menuColor: {
      type: 'int',
      desc: 'The color of the Discord embed menu commands, between 0 and 16777215. Must be an integer color.',
      checkValid: isValidInt
    },
    controllerIds: {
      type: 'array',
      desc: 'User IDs who have access to Bot Controller commands. Two arguments, \`<add/remove> <id>\`.',
      checkValid: checkControllerIds
    }
  },
  'FEED SETTINGS': {
    timezone: {
      type: 'string',
      desc: 'This is for the {date} tag customization. By default the date will be in UTC if left blank. Must be from <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones> under TZ column.',
      checkValid: isValidTimezone
    },
    timeFormat: {
      type: 'string',
      desc: 'Format how {date} is shown. See details at <http://momentjs.com/docs/#/displaying/format/>. Whatever is here, will be inside `.format(<timeFormat>)` Default is `ddd, D MMMM YYYY, h:mm A z`.'
    },
    maxFeeds: {
      type: 'int',
      desc: 'The maximum amount of feeds each server is allowed to have. Default is 0 (unlimited).',
      checkValid: isValidInt
    },
    defaultMaxAge: {
      type: 'int',
      desc: 'The max aged feed in days that the bot will grab on startup if it unexpectedly stops. Default is 1.',
      checkValid: isValidInt
    },
    defaultMessage: {
      type: 'string',
      desc: 'If no custom message is defined for a specific feed, this will be the message the feed will fallback to.'
    }
  },
  'ADVANCED': {
    batchSize: {
      type: 'int',
      desc: 'Number of requests that must finish before proceeding to the next batch per retrieval cycle. Defaults to 300.',
      checkValid: isValidInt
    }
  }
}

function printConfigHelp() {
  const message = new Discord.RichEmbed()
  .setTitle('List of Confirgurable Configs')
  .setColor(config.botSettings.menuColor)
  .setDescription(`The syntax to change certain configs through is \`${config.botSettings.prefix}setconfig <config> <argument(s)>\`\n\u200b`)

  for (var category in validConfig) {
    let description = '';
    for (var configName in validConfig[category]) {
      description += `\n\n**${configName}** (${validConfig[category][configName].type})\n*${validConfig[category][configName].desc}*`;
    }
    message.addField(category, description, true);
  }

  return message
}

exports.stats = function(bot, message) {
  message.channel.sendMessage(`Guilds: ${bot.guilds.size}\nUsers: ${bot.users.size}\nChannels: ${bot.channels.size}`).catch(err => console.log('Commands Info: Could not send stats, reason:\n', err))
}

exports.setgame = function(bot, message) {
  const content = message.content.split(' ')
  if (content.length === 1) return;
  let game = content[1]
  if (game === 'null') game = null;
  bot.user.setGame(game)
  config.botSettings.defaultGame = game // Make sure the change is saved even after a login retry
  process.send({type: 'gameUpdate', contents: game})
}

exports.pingme = function(bot, message) {
  const pong = new Discord.RichEmbed()
  .setTitle('Sending')
  .setDescription('pong!')

  message.channel.sendEmbed(pong).catch(err => console.info(`Commands Warning: Could not send the pong embed:\n`, pong))
}

exports.getsources = function(bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return;
  const sources = (currentGuilds.get(content[1]) && currentGuilds.get(content[1]).sources) ? currentGuilds.get(content[1]).sources : undefined

  if (sources) message.channel.sendMessage(`\`\`\`js\n${JSON.stringify(sources, null, 2)}\n\`\`\``);
  else message.channel.sendMessage('No sources available.');
}

exports.debug = function(bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return;

  process.send({type: 'debug', contents: content[1]})
}

exports.undebug = function(bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return;

  process.send({type: 'undebug', contents: content[1]})
}

exports.setoverride = function(bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 3) return message.channel.sendMessage(`The proper syntax to override a server's feed limit is \`${config.botSettings.prefix}setoverride <guildID> <#>\`.`);
  if (!currentGuilds.has(content[1]) || !bot.guilds.has(content[1])) return message.channel.sendMessage(`Unable to set limit, guild ID \`${content[1]}\` was either not found in guild list or has no active feeds.`);

  let newLimit = parseInt(content[2], 10)

  if (isNaN(newLimit) || newLimit % 1 !== 0) return message.channel.sendMessage(`That is not a valid number.`);

  const guildRss = currentGuilds.get(content[1])
  guildRss.limitOverride = newLimit
  overriddenGuilds.set(content[1], guildRss.limitOverride)

  fileOps.updateFile(content[1], guildRss)
  message.channel.sendMessage(`Feed limit for guild ID \`${content[1]}\` (${bot.guilds.get(content[1]).name}) has been overridden to \`${newLimit == 0 ? 'Unlimited' : newLimit}\``)
  console.log(`Bot Controller: Feed limit for guild (${content[1]}, ${bot.guilds.get(content[1]).name}) has been overridden to '${newLimit == 0 ? 'Unlimited' : newLimit}'`)
}

exports.showoverrides = function(bot, message) {
  if (overriddenGuilds.size === 0) return message.channel.sendMessage('There are no guilds with their limits overridden.');
  let msg = '```md\n'
  overriddenGuilds.forEach(function(limit, guildId) {
    let guildRss = currentGuilds.get(guildId)
    msg += `\n\n[${guildId}]: ${bot.guilds.get(guildId).name}\nStatus: ${guildRss.sources.size()}/${limit === 0 ? 'Unlimited' : limit}`
  })
  message.channel.sendMessage(msg += `\n\n\`\`\`\`\`\`Total Guilds: ${overriddenGuilds.size}\`\`\``)
}

exports.removeoverride = function(bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return message.channel.sendMessage(`The proper syntax to override a server's feed limit is \`${config.botSettings.prefix}removeoverride <guildID>\`.`);

  if (!currentGuilds.has(content[1]) || !bot.guilds.has(content[1]) || !overriddenGuilds.has(content[1])) return message.channel.sendMessage(`Unable to remove limit, guild ID \`${content[1]}\` was either not found in guild list or does not have a limit override.`);

  const guildRss = currentGuilds.get(content[1])
  delete guildRss.limitOverride
  overriddenGuilds.delete(content[1])

  fileOps.updateFile(content[1], guildRss)
  message.channel.sendMessage(`Feed limit override for guild ID \`${content[1]}\` (${bot.guilds.get(content[1]).name}) has been removed.`)
  console.log(`Bot Controller: Feed limit override for guild (${content[1]}, ${bot.guilds.get(content[1]).name}) has been removed`)

}

exports.allowcookies = function(bot, message) {
  const content = message.content.split(' ')
  if (content.length !== 2) return message.channel.sendMessage(`The proper syntax to allow cookies for a server is \`${config.botSettings.prefix}allowcookies <guildID>\`.`);

  if (!currentGuilds.has(content[1]) || !bot.guilds.has(content[1])) return message.channel.sendMessage(`Unable to allow cookies, guild ID \`${content[1]}\` was either not found in guild list or has no active feeds.`);

  const guildRss = currentGuilds.get(content[1])
  guildRss.allowCookies = true

  fileOps.updateFile(content[1], guildRss)
  message.channel.sendMessage(`Cookies are now allowed for guild ID \`${content[1]}\` (${bot.guilds.get(content[1]).name}).`)
  console.log(`Bot Controller: Cokkies have been allowed for guild (${content[1]}, ${bot.guilds.get(content[1]).name})`)
}

exports.disallowcookies = function(bot, message) {
  if (!config.advanced || config.advanced.restrictCookies === false || !config.advanced.restrictCookies) return message.channel.sendMessage(`Cannot disallow cookies if config \`restrictCookies\` is not set to \`true\`/\`1\`.`)
  const content = message.content.split(' ')
  if (content.length !== 2) return message.channel.sendMessage(`The proper syntax to allow cookies for a server is \`${config.botSettings.prefix}disallowcookies <guildID>\`.`);
  if (!currentGuilds.has(content[1]) || !bot.guilds.has(content[1])) return message.channel.sendMessage(`Guild ID \`${content[1]}\` was either not found in guild list or has no active feeds.`);

  const guildRss = currentGuilds.get(content[1])
  delete guildRss.allowCookies

  fileOps.updateFile(content[1], guildRss)
  message.channel.sendMessage(`Cookies are now disallowed for guild ID \`${content[1]}\` (${bot.guilds.get(content[1]).name})\`.`)
  console.log(`Bot Controller: Cokkies have been disallowed for guild (${content[1]}, ${bot.guilds.get(content[1]).name})`)
}

exports.setconfig = function(bot, message) {
  const content = message.content.split(' ')
  if (content.length === 1) return message.channel.sendEmbed(printConfigHelp());
  if (content.length === 2) return message.channel.sendMessage(`The proper syntax to change certain configs through is ${config.botSettings.prefix}setconfig <config> <argument(s)>.`);
  for (var category in validConfig) {
    for (var configName in validConfig[category]) {
      if (content[1] === configName) {
        let configObject = validConfig[category][configName];
        if (configObject.checkValid && configObject.checkValid(configName, message.content) !== true) return message.channel.sendMessage(configObject.checkValid(configName, message.content));
        var setting;

        switch(configObject.type) {
          case 'int':
          case 'bool':
            setting = parseInt(content[2], 10);
            break;

          case 'array':
            setting = config.botSettings.controllerIds;
            if (content[2] === 'add') setting.push(content[3]);
            else if (content[2] === 'remove') {
              let found = false;
              for (var index in setting) if (setting[index] === content[3]) {
                found = true;
                setting.splice(index, 1);
              }
              if (!found) {
                setting = null;
                message.channel.sendMessage('No such controller ID exists to be removed.');
              }
            }
            break;

          case 'string':
            setting = content[2];
        }

        if (setting == null) return;
        let categoryName = '';

        switch(category) {
          case 'ADVANCED':
          case 'LOGGING':
            categoryName = category.toLowerCase();
            break;
          case 'FEED SETTINGS':
            categoryName = 'feedSettings';
            break;
          case 'BOT SETTINGS':
            categoryName = 'botSettings';
        }

        if (!config[categoryName]) config[categoryName] = {};
        config[categoryName][configName] = setting;
        process.send({type: 'configChange', configCategory: categoryName, configName: configName, configSetting: setting});
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
        console.log(`Bot Controller: Config '${configName}' value has been changed to to '${setting}'.`)
        return message.channel.sendMessage(`Config \`${configName}\`'s current value is now set to \`${setting}\`.`);

      }
    }
  }

  message.channel.sendMessage('No such config found.')
}
