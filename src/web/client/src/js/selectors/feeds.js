export function getActiveFeed (state) {
  const feeds = state.feeds
  return feeds.find(feed => feed._id === state.activeFeedID)
}

export function getActiveFeedID (state) {
  return state.activeFeedID
}
