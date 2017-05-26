const filterFeed = require('./filters.js')

module.exports = function (rssList, rssName, article) {
  let mentions = ''

  // Get global subscriptions
  if (rssList[rssName].roleSubscriptions) {
    const globalSubList = rssList[rssName].roleSubscriptions
    for (let role in globalSubList) {
      mentions += `<@&${globalSubList[role].roleID}> `
    }
  }

  // Get filtered subscriptions
  if (rssList[rssName].filters && rssList[rssName].filters.roleSubscriptions) {
    const subscribedRoles = rssList[rssName].filters.roleSubscriptions
    for (let role in subscribedRoles) {
      if (filterFeed(subscribedRoles, role, article)) mentions += `<@&${role}> `
    }
  }

  return mentions
}
