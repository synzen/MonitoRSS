const filterAdd = require('./filterAdd.js')
const filterRemove = require('./filterRemove.js')
const rssConfig = require('../rssConfig.json')

module.exports = function(message, rssIndex, role) {
  var rssList = require(`../sources/${message.guild.id}.json`).sources

  var menu = {embed: {
    color: rssConfig.menuColor,
    description: `**Feed Title:** ${rssList[rssIndex].title}\n**Feed Link:** ${rssList[rssIndex].link}\n\nSelect an option by typing its number, or type *exit* to cancel. Only messages that contain any of the words defined in these global filters will be sent to Discord. It is recommended to test the delivery of your feeds first before adding filters.\n_____`,
    author: {name: `Feed Filters Customization`},
    fields: [{name: `1) Add global filter to  feed`, value: `Add a new filter to a specific category.`},
            {name: `2) Remove a global filter from a feed`, value: `Remove an existing filter, if any.`}],
    footer: {}
  }}

  message.channel.sendMessage("", menu)

  const filter = m => m.author.id == message.author.id;
  const collector = message.channel.createCollector(filter,{time:60000});

  collector.on('message', function (m) {
    if (m.content.toLowerCase() == "exit") return collector.stop("RSS Filter Action selection menu closed.");
    if (m.content == 1) {collector.stop(); return filterAdd(message, rssIndex);}
    else if (m.content == 2) {collector.stop(); return filterRemove(message, rssIndex);}
    else message.channel.sendMessage("That is not a valid choice. Try again.");
  })

  collector.on('end', (collected, reason) => {
    if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`);
    else if (reason !== "user") return message.channel.sendMessage(reason);
  })
}
