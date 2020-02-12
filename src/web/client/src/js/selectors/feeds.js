import { GET_ARTICLES, DELETE_FEED, EDIT_FEED, GET_FEEDS, ADD_FEED } from "js/constants/actions/feeds"

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

function feedAdding (state) {
  return state.loading[ADD_FEED.BEGIN]
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
  feedAdding,
  feedRemoving,
  feedEditing,
  feedsFetching,
  feedsFetchError
}
