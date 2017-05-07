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
    const currentCookies = (rssList[rssName].advanced && rssList[rssName].advanced.cookies && rssList[rssName].advanced.cookies.length > 0) ? rssList[rssName].advanced.cookies : undefined

    let msg = (currentCookies) ? `The current cookie set for <${rssList[rssName].link}> is shown below.\`\`\`\n${currentCookies}\n\`\`\`` : '```No cookies set.```\n'

    message.channel.send(msg + '\n\nType your new cookie now, or type exit to cancel.')
    .then(function(msgPrompt) {
      const filter = m => m.author.id == message.author.id
      const customCollect = message.channel.createMessageCollector(filter,{time:240000})
      channelTracker.addCollector(message.channel.id)

      customCollect.on('collect', function(m) {
        if (m.content.toLowerCase() === 'exit') return customCollect.stop('Cookie customization menu closed.');

        customCollect.stop()
        const cookie = m.content;

        if (!rssList[rssName].advanced) rssList[rssName].advanced = {cookies: {}};
        rssList[rssName].advanced.cookies = cookie

        fileOps.updateFile(message.guild.id, guildRss)

        message.channel.send(`Your new cookie for <${rssList[rssName].link}> is now\n\`\`\`\n${cookie}\`\`\``)
        console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Cookie for ${rssList[rssName].link} has been set to `, cookie);
      })

      customCollect.on('end', function(collected, reason) {
        channelTracker.removeCollector(message.channel.id)
        if (reason == 'time') return message.channel.send(`I have closed the menu due to inactivity.`).catch(err => {});
        else if (reason !== 'user') return message.channel.send(reason);
      });
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send custom cookies message (${err}).`));



  })

}
