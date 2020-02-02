import { GET_ARTICLES } from "js/constants/actions/feeds"

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
