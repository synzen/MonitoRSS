const fs = require('fs')
const config = require('../../config.json')
const storage = require('../../util/storage.js')

exports.normal = function (bot, message, skipMessage) {
  const cookieAccessors = storage.cookieAccessors
  if (!config.advanced || config.advanced.restrictCookies !== true || !config.advanced.restrictCookies) return message.channel.send(`Cannot disallow cookies if config \`restrictCookies\` is not set to \`true\`/\`1\`.`)
  const content = message.content.split(' ')
  if (content.length !== 2) return message.channel.send(`The proper syntax to allow cookies for a user is \`${config.botSettings.prefix}disallowcookies <userID>\`.`)
  const userID = content[1]

  const user = bot.users.get(userID)
  const username = user.username
  for (var index in cookieAccessors.ids) {
    if (cookieAccessors.ids[index] === userID) {
      cookieAccessors.ids.splice(index, 1)
      try {
        fs.writeFileSync('./settings/cookieAccessors.json', JSON.stringify(cookieAccessors, null, 2))
        if (!skipMessage) message.channel.send(`User ID \`${userID}\` (${user ? username : 'User not found in bot user list.'}) removed from cookie accessor list.`)
        console.log(`Bot Controller: User ID ${userID} (${user ? username : 'User not found in bot user list.'}) removed from cookie accessor list by (${message.author.id}, ${message.author.username}).`)
        return true
      } catch (e) {
        console.log(`Bot Controller: Unable to write to file cookieAccessors for command disallowcookies: `, e.message || e)
        message.channel.send(`Unable to write to file cookieAccessors for command disallowcookies.`, e.message || e)
      }
    }
  }

  message.channel.send(`Cannot remove. User ID \`${userID}\` was not found in list of cookie accessors.`)
}

exports.sharded = function (bot, message, Manager) {
  if (exports.normal(bot, message, true) !== true) return

  if (!config.advanced || config.advanced.restrictCookies !== true || !config.advanced.restrictCookies) return message.channel.send(`Cannot disallow cookies if config \`restrictCookies\` is not set to \`true\`/\`1\`.`)
  const content = message.content.split(' ')
  if (content.length !== 2) return message.channel.send(`The proper syntax to allow cookies for a user is \`${config.botSettings.prefix}disallowcookies <userID>\`.`)
  const userID = content[1]

  bot.shard.broadcastEval(`
    const appDir = require('path').dirname(require.main.filename);
    const cookieAccessors = require(appDir + '/util/storage.js').cookieAccessors;

    for (var index in cookieAccessors.ids) {
      if (cookieAccessors.ids[index] === '${userID}') {
        cookieAccessors.ids.splice(index, 1);
        break;
      }
    }
  `).then(results => {
    message.channel.send(`User ID \`${userID}\` removed from cookie accessor list.`)
  }).catch(err => console.log(`Bot Controller: Unable to eval update cookieAccessors after disallowcookies. `, err.message || err))
}
