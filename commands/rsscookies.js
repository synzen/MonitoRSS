const channelTracker = require('../util/channelTracker.js')
const config = require('../config.json')
const currentGuilds = require('../util/guildStorage.js').currentGuilds
const getIndex = require('./util/printFeeds.js')
const fileOps = require('../util/fileOps.js')

module.exports = function(bot, message, command) {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources) return message.channel.sendMessage('You must have at least one active feed to use this command.');
  if (config.advanced && config.advanced.restrictCookies === true && guildRss.allowCookies !== true || guildRss.allowCookies === false) return message.channel.sendMessage('You do not have access to cookie control.').then(m => m.delete(3500));

  const rssList = guildRss.sources

  function sanitize(array) {
    for (var p = array.length - 1; p >= 0; p--) { // Sanitize by removing spaces and newlines
      array[p] = array[p].trim();
      if (!array[p]) array.splice(p, 1);
    }

    return array
  }

  getIndex(bot, message, command, function(rssName) {
    const currentCookies = (rssList[rssName].advanced && rssList[rssName].advanced.cookies && rssList[rssName].advanced.cookies.length > 0) ? rssList[rssName].advanced.cookies : undefined

    let msg = (currentCookies) ? `The current cookies set for <${rssList[rssName].link}> is shown below.\`\`\`\n` : '```No cookies set.```\n'

    if (currentCookies) {
      for (var cookie in currentCookies) {
        msg += `\n${currentCookies[cookie]}`;
      }
    }

    message.channel.sendMessage(msg + '\`\`\`\n\nType your new cookies now, each one separated by a semicolon, or type exit to cancel.')
    .then(function(msgPrompt) {
      const filter = m => m.author.id == message.author.id
      const customCollect = message.channel.createCollector(filter,{time:240000})
      channelTracker.addCollector(message.channel.id)

      customCollect.on('message', function(m) {
        if (m.content.toLowerCase() === 'exit') return customCollect.stop('Cookie customization menu closed.');

        customCollect.stop()
        const cookieList = sanitize(m.content.split(';'));

        if (!rssList[rssName].advanced) rssList[rssName].advanced = {cookies: {}};
        rssList[rssName].advanced.cookies = cookieList

        fileOps.updateFile(message.guild.id, guildRss)

        let newCookieList = `Your new cookies for <${rssList[rssName].link}> are now\n\`\`\`\n`
        for (var newCookie in cookieList) {
          newCookieList += `\n* ${cookieList[newCookie]}`;
        }

        message.channel.sendMessage(newCookieList + '```')
        console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Cookies for ${rssList[rssName].link} has been set to `, cookieList);
      })

      customCollect.on('end', function(collected, reason) {
        channelTracker.removeCollector(message.channel.id)
        if (reason == 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
        else if (reason !== 'user') return message.channel.sendMessage(reason);
      });
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send custom cookies message (${err}).`));



  })

}
