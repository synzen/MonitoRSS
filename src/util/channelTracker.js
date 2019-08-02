/*
    Used to keep track of channels with active menus, and to
    disallow any channels to activate commands with active menus.
*/

const activeCollectors = {}

exports.add = channelID => {
  if (!activeCollectors[channelID]) activeCollectors[channelID] = 0
  activeCollectors[channelID]++
}

exports.remove = channelID => {
  activeCollectors[channelID]--
  if (activeCollectors[channelID] <= 0) delete activeCollectors[channelID]
}

exports.hasActiveMenus = channelID => !!activeCollectors[channelID]
