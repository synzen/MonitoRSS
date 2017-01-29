
var activeCollectors = {}

exports.addCollector = function (channelID) {
  if (activeCollectors[channelID] == null) activeCollectors[channelID] = 0;
  activeCollectors[channelID]++
}

exports.removeCollector = function (channelID) {
  activeCollectors[channelID]--
  if (activeCollectors[channelID] <= 0) delete activeCollectors[channelID];
}

exports.hasActiveMenus = function (channelID) {
  if (activeCollectors[channelID] == null) return false;
  else return true;
}
