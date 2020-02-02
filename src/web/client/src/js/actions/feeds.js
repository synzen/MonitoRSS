import axios from 'axios'
import {
  GET_FEEDS,
  GET_ARTICLES,
  SET_ACTIVE_FEED
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

export function setFeedsFailure () {
  return {
    type: GET_FEEDS.FAILURE
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

export function setArticlesSuccess (articles) {
  return {
    type: GET_ARTICLES.SUCCESS,
    payload: articles
  }
}

export function setArticlesFailure () {
  return {
    type: GET_ARTICLES.FAILURE
  }
}

export function setArticlesBegin () {
  return {
    type: GET_ARTICLES.BEGIN
  }
}
