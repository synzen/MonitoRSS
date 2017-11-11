const fs = require('fs')
const config = require('../../config.json')
const storage = require('../../util/storage.js')

exports.normal = function (bot, message) {
  const cookieAccessors = storage.cookieAccessors
  if (!config.advanced || config.advanced.restrictCookies !== true) return message.channel.sendMessage('Cookie usage is allowed by default if `restrictCookies` is not set to `true`.')
  const content = message.content.split(' ')
  const userID = content[1]

  if (content.length !== 2) return message.channel.send(`The proper syntax to allow cookies for a user is \`${config.botSettings.prefix}allowcookies <userID>\`.`)
  if (!bot.users.get(userID)) return message.channel(`Unable to allow cookies. User ID \`${userID}\` was not found in user list.`)
  if (cookieAccessors.ids.includes(userID)) return message.channel.sendMessage(`User ID \`${userID}\` already has permission for cookie usage.`)

  cookieAccessors.ids.push(userID)

  try {
    fs.writeFileSync('./settings/cookieAccessors.json', JSON.stringify(cookieAccessors, null, 2))

    const username = bot.users.get(userID).username
    message.channel.send(`Cookies are now allowed for user ID \`${userID}\` (${username}).`)
    console.log(`Bot Controller: Cookies have been allowed for user ID ${userID}, (${username}) by (${message.author.id}, ${message.author.username})`)
    return true
  } catch (e) {
    console.info(`Bot Controller: Unable to write to file cookieAccessors for command allowcookies: `, e.message || e)
    message.channel.send(`Unable to write to file cookieAccessors for command allowcookies.`, e.message || e)
  }
}

exports.sharded = function (bot, message, Manager) {
  const cookieAccessors = storage.cookieAccessors
  if (!config.advanced || config.advanced.restrictCookies !== true) return message.channel.sendMessage('Cookie usage is allowed by default if `restrictCookies` is not set to `true`.')
  const content = message.content.split(' ')
  if (content.length !== 2) return message.channel.send(`The proper syntax to allow cookies for a user is \`${config.botSettings.prefix}allowcookies <userID>\`.`)

  const userID = content[1]

  if (bot.users.get(userID)) {
    if (cookieAccessors.ids.includes(userID)) return message.channel.sendMessage(`User ID \`${userID}\` already has permission for cookie usage.`)
    if (exports.normal(bot, message)) {
      bot.shard.broadcastEval(`
        const appDir = require('path').dirname(require.main.filename);
        const cookieAccessors = require(appDir + '/util/storage.js').cookieAccessors;
        if (!cookieAccessors.ids.includes('${userID}')) cookieAccessors.ids.push('${userID}');
      `).catch(err => console.log(`Bot Controller: Unable to eval update cookieAccessors after normal allowCookies: `, err.message || err))
    }
    return
  }

  // This may happen for several shards since the user may be cached for different shards
  bot.shard.broadcastEval(`
    const fs = require('fs');
    const appDir = require('path').dirname(require.main.filename);
    const cookieAccessors = require(appDir + '/util/storage.js').cookieAccessors;

    if (this.users.get('${userID}')) {
      if (!cookieAccessors.ids.includes('${userID}')) {;
        cookieAccessors.ids.push('${userID}');
        try {
          fs.writeFileSync('./settings/cookieAccessors.json', JSON.stringify(cookieAccessors, null, 2));
          const username = this.users.get('${userID}').username;
          console.log('Bot Controller: Cookies have been allowed for user ID ${userID} (' + username + ') by (${message.author.id}, ${message.author.username})');
          'Cookies are now allowed for user ID ${userID} (' + username + ')';
        } catch (e) {
          console.info(e.message || e)
        }
      }
    }
  `).then(results => {
    for (var x in results) {
      if (results[x]) {
        bot.shard.broadcastEval(`
          const appDir = require('path').dirname(require.main.filename);
          const cookieAccessors = require(appDir + '/util/storage.js').cookieAccessors;
          if (!cookieAccessors.ids.includes('${userID}')) cookieAccessors.ids.push('${userID}');
        `).catch(err => console.log(`Bot Controller: Unable to eval update cookieAccessors after eval allowcookies broadcast: `, err.message || err))
        return message.channel.send(results[x])
      }
    }
    message.channel.send(`Unable to allow cookies. User ID \`${userID}\` was not found in user list.`)
  }).catch(err => console.log(`Bot Controller: Unable to broadcast eval allowcookies. `, err.message || err))
}
