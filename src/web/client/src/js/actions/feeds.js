import axios from 'axios'
import {
  GET_FEEDS,
  GET_ARTICLES,
  SET_ACTIVE_FEED,
  DELETE_FEED,
  EDIT_FEED
} from '../constants/actions/feeds'

export function fetchGuildFeeds (guildID) {
  return dispatch => {
    dispatch(setFeedsBegin())
    axios.get(`/api/guilds/${guildID}/feeds`).then(({ data }) => {
      dispatch(setFeedsSuccess(data))
    }).catch(err => {
      console.log(err)
      dispatch(setFeedsFailure(err))
    })
  }
}

export function fetchGuildFeedArticles (guildID, feedID) {
  return dispatch => {
    dispatch(setArticlesBegin())
    axios.get(`/api/guilds/${guildID}/feeds/${feedID}/placeholders`).then(({ data }) => {
      dispatch(setArticlesSuccess(data))
    }).catch(err => {
      dispatch(setArticlesFailure(err))
    })
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
    dispatch(fetchGuildFeedArticles(guildID, feedID))
  }
}

export function fetchDeleteFeed (guildID, feedID) {
  return dispatch => {
    dispatch(deleteFeedBegin())
    axios.delete(`/api/guilds/${guildID}/feeds/${feedID}`).then(({ data }) => {
      dispatch(deleteFeedSuccess(feedID))
    }).catch(err => {
      dispatch(deleteFeedFailure(err))
    })
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
  return dispatch => {
    dispatch(editFeedBegin())
    axios.patch(`/api/guilds/${guildID}/feeds/${feedID}`, data).then(({ data }) => {
      dispatch(editFeedSuccess(data))
    }).catch(err => {
      dispatch(editFeedFailure(err))
    })
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
