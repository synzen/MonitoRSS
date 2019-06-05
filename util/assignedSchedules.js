const assigned = {}

module.exports = {
  setScheduleName: (rssName, scheduleName) => {
    assigned[rssName] = scheduleName
  },
  getScheduleName: rssName => assigned[rssName],
  clearScheduleName: rssName => delete assigned[rssName]
}
