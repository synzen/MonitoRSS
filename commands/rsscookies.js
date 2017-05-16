const channelTracker = require('../util/channelTracker.js')
const config = require('../config.json')
const storage =  require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const cookieAccessors = storage.cookieAccessors
const getIndex = require('./util/printFeeds.js')
const fileOps = require('../util/fileOps.js')

module.exports = function(bot, message, command) {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources) return message.channel.send('You must have at least one active feed to use this command.');
  if (config.advanced && config.advanced.restrictCookies === true && !cookieAccessors.ids.includes(message.author.id)) return message.channel.send('You do not have access to cookie control.').then(m => m.delete(3500));

  const rssList = guildRss.sources

  getIndex(bot, message, command, function(rssName) {
    let currentCookies = ''
    const cookieObj = (rssList[rssName].advanced && rssList[rssName].advanced.cookies && rssList[rssName].advanced.cookies.size() > 0) ? rssList[rssName].advanced.cookies : undefined
    if (cookieObj) for (var cookieKey in cookieObj) {
      currentCookies += `\n${cookieKey} = ${cookieObj[cookieKey]}`;
    }

    let msg = (currentCookies) ? `The current cookie(s) set for <${rssList[rssName].link}> is shown below.\`\`\`\n${currentCookies}\n\`\`\`` : `The current cookie(s) set for <${rssList[rssName].link}> is shown below.\`\`\`No cookies set.\`\`\``

    message.channel.send(msg + '\nType your new cookie(s) now with each one separated by a new line. Each cookie must have \`=\` between the key and its value. For example, \`cookieKey=myValue\`. Your current cookie(s) will be overwritten. To remove all cookies, type \`reset\`. To cancel, type \`exit\`.')
    .then(function(msgPrompt) {
      const filter = m => m.author.id == message.author.id
      const customCollect = message.channel.createMessageCollector(filter,{time:240000})
      channelTracker.addCollector(message.channel.id)

      customCollect.on('collect', function(m) {
        if (m.content.toLowerCase() === 'exit') return customCollect.stop('Cookie customization menu closed.');
        if (m.content.toLowerCase() === 'reset') {
          customCollect.stop();
          delete rssList[rssName].advanced.cookies;
          fileOps.updateFile(message.guild.id, guildRss);
          console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Cookies have been reset for ${rssList[rssName].link}.`);
          return message.channel.send(`Successfully removed all cookies for feed ${rssList[rssName].link}`);
        }

        customCollect.stop()
        const cookieArray = m.content.split('\n');

        if (!rssList[rssName].advanced) rssList[rssName].advanced = {cookies: {}};
        else rssList[rssName].advanced.cookies = {};

        let newCookies = ''
        for (var index in cookieArray) {
          const pair = cookieArray[index].split('=');
          if (pair.length === 2) rssList[rssName].advanced.cookies[pair[0].trim()] = pair[1].trim();
          newCookies += `\n${pair[0].trim()} = ${pair[1].trim()}`;
        }

        fileOps.updateFile(message.guild.id, guildRss)

        message.channel.send(`Your new cookie(s) for <${rssList[rssName].link}> is now\n\`\`\`\n${newCookies}\`\`\``)
        console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Cookies for ${rssList[rssName].link} have been set to\n${newCookies}\n`);
      })

      customCollect.on('end', function(collected, reason) {
        channelTracker.removeCollector(message.channel.id)
        if (reason == 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => {});
        else if (reason !== 'user') return message.channel.send(reason);
      });
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send custom cookies message (${err}).`));



  })

}
