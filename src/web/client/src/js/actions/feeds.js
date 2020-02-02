import axios from 'axios'
import {
  GET_FEEDS,
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

export function setFeedsSuccess (channels) {
  return {
    type: GET_FEEDS.SUCCESS,
    payload: channels
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
  return {
    type: SET_ACTIVE_FEED,
    payload: feedID
  }
}
