const filterFeed = require('./filters.js')

module.exports = function(channel, rssName, article) {
  var rssList = require(`../../sources/${channel.guild.id}.json`).sources

  var mentions = ''

  // Get global subscriptions
  if (rssList[rssName].roleSubscriptions) {
    let globalSubList = rssList[rssName].roleSubscriptions;
    for (let role in globalSubList) {
      mentions += `<@&${globalSubList[role].roleID}> `
    }
  }

  // Get filtered subscriptions
  if (rssList[rssName].filters && rssList[rssName].filters.roleSubscriptions) {
    let subscribedRoles = rssList[rssName].filters.roleSubscriptions;
    for (let role in subscribedRoles) {
      if (filterFeed(subscribedRoles, role, article)) mentions += `<@&${role}> `;
    }
  }

  return mentions
}
