import axios from 'axios'
import {
  GET_FEEDS,
  GET_ARTICLES,
  SET_ACTIVE_FEED,
  DELETE_FEED,
  EDIT_FEED
} from '../constants/actions/feeds'
import FetchStatusActions from './utils/FetchStatusActions'

export const {
  begin: setFeedsBegin,
  success: setFeedsSuccess,
  failure: setFeedsFailure
} = new FetchStatusActions(GET_FEEDS)

export const {
  begin: deleteFeedBegin,
  success: deleteFeedSuccess,
  failure: deleteFeedFailure
} = new FetchStatusActions(DELETE_FEED)

export const {
  begin: editFeedBegin,
  success: editFeedSuccess,
  failure: editFeedFailure
} = new FetchStatusActions(EDIT_FEED)

export const {
  begin: setArticlesBegin,
  success: setArticlesSuccess,
  failure: setArticlesFailure
} = new FetchStatusActions(GET_ARTICLES)

export function fetchGuildFeeds (guildID) {
  return async (dispatch, getState) => {
    try {
      const { activeFeedID } = getState()
      dispatch(setFeedsBegin())
      const { data } = await axios.get(`/api/guilds/${guildID}/feeds`)
      dispatch(setFeedsSuccess(data))
      if (!data.find(feed => feed._id === activeFeedID)) {
        await dispatch(setActiveFeed(''))
      }
    } catch (err) {
      dispatch(setFeedsFailure(err))
    }
  }
}

export function fetchGuildFeedArticles (guildID, feedID) {
  return async dispatch => {
    try {
      dispatch(setArticlesBegin())
      const { data } = await axios.get(`/api/guilds/${guildID}/feeds/${feedID}/placeholders`)
      dispatch(setArticlesSuccess(data))
    } catch (err) {
      dispatch(setArticlesFailure(err))
    }
  }
}

export function setActiveFeed (feedID) {
  return async (dispatch, getState) => {
    const { activeGuildID } = getState()
    dispatch({
      type: SET_ACTIVE_FEED,
      payload: feedID
    })
    if (!feedID) {
      dispatch(setArticlesSuccess([]))
      return
    }
    await dispatch(fetchGuildFeedArticles(activeGuildID, feedID))
  }
}

export function fetchDeleteFeed (guildID, feedID) {
  return async dispatch => {
    try {
      dispatch(deleteFeedBegin())
      await axios.delete(`/api/guilds/${guildID}/feeds/${feedID}`)
      dispatch(deleteFeedSuccess(feedID))
    } catch (err) {
      dispatch(deleteFeedFailure(err))
    }
  }
}

export function fetchEditFeed (guildID, feedID, data) {
  return async dispatch => {
    try {
      dispatch(editFeedBegin())
      const { data } = await axios.patch(`/api/guilds/${guildID}/feeds/${feedID}`, data)
      dispatch(editFeedSuccess(data))        
    } catch (err) {
      dispatch(editFeedFailure(err))
    }
  }
}
