const filterFeed = require('./filters.js')

module.exports = function (channel, rssIndex, data, dataDescrip) {
  var rssList = require(`../../sources/${channel.guild.id}.json`).sources

  var mentions = ""

  if (rssList[rssIndex].roleSubscriptions != null) {
    let globalSubList = rssList[rssIndex].roleSubscriptions;
    for (let role in globalSubList) {
      mentions += `<@&${globalSubList[role].roleID}> `
    }
  }

  if (rssList[rssIndex].filters != null && rssList[rssIndex].filters.roleSubscriptions != null) {
    let subscribedRoles = rssList[rssIndex].filters.roleSubscriptions;
    for (let role in subscribedRoles) {
      var filterFound = filterFeed(subscribedRoles, role, data, dataDescrip);
      if (filterFound) {
        console.log(filterFound);
        mentions += `<@&${role}> `;
      }
    }
  }

  return mentions
}
