import { GET_ARTICLES, DELETE_FEED, EDIT_FEED, GET_FEEDS } from "js/constants/actions/feeds"

function activeFeed (state) {
  const feeds = state.feeds
  return feeds.find(feed => feed._id === state.activeFeedID)
}

function activeFeedID (state) {
  return state.activeFeedID
}

function articlesFetching (state) {
  return state.loading[GET_ARTICLES.BEGIN]
}

function articlesFetchErrored (state) {
  return state.errors[GET_ARTICLES.FAILURE]
}

function feedRemoving (state) {
  return state.loading[DELETE_FEED.BEGIN]
}

function feedEditing (state) {
  return state.loading[EDIT_FEED.BEGIN]
}

function feedsFetching (state) {
  return state.loading[GET_FEEDS.BEGIN]
}

function feedsFetchError (state) {
  return state.errors[GET_FEEDS.FAILURE]
}

export default {
  activeFeed,
  activeFeedID,
  articlesFetching,
  articlesFetchErrored,
  feedRemoving,
  feedEditing,
  feedsFetching,
  feedsFetchError
}
