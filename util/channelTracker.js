/*
    Used to keep track of channels with active menus, and to
    disallow any channels to activate commands with active menus.
    
*/

var activeCollectors = {}

exports.addCollector = function (channelID) {
  if (!activeCollectors[channelID]) activeCollectors[channelID] = 0;
  activeCollectors[channelID]++
}

exports.removeCollector = function (channelID) {
  activeCollectors[channelID]--
  if (activeCollectors[channelID] <= 0) delete activeCollectors[channelID];
}

exports.hasActiveMenus = function (channelID) {
  if (!activeCollectors[channelID]) return false;
  else return true;
}
