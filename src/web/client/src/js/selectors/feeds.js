import { GET_ARTICLES, DELETE_FEED, EDIT_FEED } from "js/constants/actions/feeds"

export function getActiveFeed (state) {
  const feeds = state.feeds
  return feeds.find(feed => feed._id === state.activeFeedID)
}

export function getActiveFeedID (state) {
  return state.activeFeedID
}

export function articlesFetching (state) {
  return state.loading[GET_ARTICLES.BEGIN]
}

export function articlesFetchErrored (state) {
  return state.errors[GET_ARTICLES.FAILURE]
}

export function feedRemoving (state) {
  return state.loading[DELETE_FEED.BEGIN]
}

export function feedEditing (state) {
  return state.loading[EDIT_FEED.BEGIN]
}
