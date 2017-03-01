const fileOps = require('../util/fileOps.js')
const getIndex = require('./util/printFeeds.js')
const sqlCmds = require('../rss/sql/commands.js')
const config = require('../config.json')

module.exports = function (bot, message, command, callback) {

  getIndex(bot, message, command, function (rssIndex) {
    var guildRss = require(`../sources/${message.guild.id}.json`)
    var rssList = guildRss.sources

    var link = rssList[rssIndex].link

    //must be checked because this is called when chanels are deleted as well
    if (message.channel) var msg = message.channel.sendMessage(`Removing ${link}...`).catch(err => `Promise Warning: rssRemove 1: ${err}`);

    console.log(`RSS Removal: (${message.guild.id}, ${message.guild.name}) => Starting removal of ${link}`)
    sqlCmds.dropTable(config.feedManagement.databaseName, rssList[rssIndex].name, function () {
      console.log(`RSS Removal: (${message.guild.id}, ${message.guild.name}) => Removal successful.`)
    })
    rssList.splice(rssIndex,1)
    fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`)
    
    if (typeof callback === 'function') callback();

    if (message.channel) msg.then(m => m.edit(`Successfully removed ${link} from this channel.`).catch(err => `Promise Warning: rssRemove 1a: ${err}`));
  })
}
