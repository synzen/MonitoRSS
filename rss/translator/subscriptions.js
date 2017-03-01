const filterFeed = require('./filters.js')

module.exports = function (channel, rssIndex, article) {
  var rssList = require(`../../sources/${channel.guild.id}.json`).sources

  var mentions = ''

  if (rssList[rssIndex].roleSubscriptions) {
    let globalSubList = rssList[rssIndex].roleSubscriptions;
    for (let role in globalSubList) {
      mentions += `<@&${globalSubList[role].roleID}> `
    }
  }

  if (rssList[rssIndex].filters && rssList[rssIndex].filters.roleSubscriptions) {
    let subscribedRoles = rssList[rssIndex].filters.roleSubscriptions;
    for (let role in subscribedRoles) {
      if (filterFeed(subscribedRoles, role, article)) mentions += `<@&${role}> `;
    }
  }

  return mentions
}
