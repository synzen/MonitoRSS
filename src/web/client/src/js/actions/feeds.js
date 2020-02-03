import axios from 'axios'
import {
  GET_FEEDS,
  GET_ARTICLES,
  SET_ACTIVE_FEED,
  DELETE_FEED,
  EDIT_FEED
} from '../constants/actions/feeds'

export function fetchGuildFeeds (guildID) {
  return async dispatch => {
    try {
      dispatch(setFeedsBegin())
      const { data } = await axios.get(`/api/guilds/${guildID}/feeds`)
      dispatch(setFeedsSuccess(data))
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

export function setFeedsSuccess (feeds) {
  return {
    type: GET_FEEDS.SUCCESS,
    payload: feeds
  }
}

export function setFeedsFailure (error) {
  return {
    type: GET_FEEDS.FAILURE,
    payload: error
  }
}

export function setFeedsBegin () {
  return {
    type: GET_FEEDS.BEGIN
  }
}

export function setActiveFeed (feedID) {
  return (dispatch, getState) => {
    const state = getState()
    const guildID = state.activeGuildID
    dispatch({
      type: SET_ACTIVE_FEED,
      payload: feedID
    })
    return dispatch(fetchGuildFeedArticles(guildID, feedID))
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

export function deleteFeedBegin () {
  return {
    type: DELETE_FEED.BEGIN
  }
}

export function deleteFeedSuccess (feedID) {
  return {
    type: DELETE_FEED.SUCCESS,
    payload: feedID
  }
}

export function deleteFeedFailure (error) {
  return {
    type: DELETE_FEED.FAILURE,
    payload: error
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

export function editFeedBegin () {
  return {
    type: EDIT_FEED.BEGIN
  }
}

export function editFeedSuccess (updatedFeed) {
  return {
    type: EDIT_FEED.SUCCESS,
    payload: updatedFeed
  }
}

export function editFeedFailure (error) {
  return {
    type: EDIT_FEED.FAILURE,
    payload: error
  }
}

export function setArticlesSuccess (articles) {
  return {
    type: GET_ARTICLES.SUCCESS,
    payload: articles
  }
}

export function setArticlesFailure (error) {
  return {
    type: GET_ARTICLES.FAILURE,
    payload: error
  }
}

export function setArticlesBegin () {
  return {
    type: GET_ARTICLES.BEGIN
  }
}
