import axios from 'axios'
import {
  GET_FEEDS,
  GET_ARTICLES,
  SET_ACTIVE_FEED,
  DELETE_FEED,
  EDIT_FEED,
  ADD_FEED
} from '../constants/actions/feeds'
import FetchStatusActions from './utils/FetchStatusActions'
import { fetchGuildFeedSubscribers, getSubscribersSuccess } from './subscribers'
import { fetchGuildFeedSchedule } from './schedules'
import toast from 'js/components/ControlPanel/utils/toast'

export const {
  begin: setFeedsBegin,
  success: setFeedsSuccess,
  failure: setFeedsFailure
} = new FetchStatusActions(GET_FEEDS)

export const {
  begin: addFeedBegin,
  success: addFeedSuccess,
  failure: addFeedFailure
} = new FetchStatusActions(ADD_FEED)

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

export function addGuildFeed (guildID, feedData) {
  return async dispatch => {
    try {
      dispatch(addFeedBegin())
      const { data } = await axios.post(`/api/guilds/${guildID}/feeds`, feedData)
      toast.success(`Successfully added feed!`)
      dispatch(addFeedSuccess(data))
    } catch (err) {
      dispatch(addFeedFailure(err))
    }
  }
}

export function fetchGuildFeeds (guildID) {
  return async (dispatch, getState) => {
    try {
      const { activeFeedID } = getState()
      dispatch(setFeedsBegin())
      const { data } = await axios.get(`/api/guilds/${guildID}/feeds`)
      dispatch(setFeedsSuccess(data))
      for (const feed of data) {
        // No need to explicitly wait for schedules to be fetched
        dispatch(fetchGuildFeedSchedule(guildID, feed._id))
      }
      if (!data.find(feed => feed._id === activeFeedID)) {
        await dispatch(setActiveFeed(''))
      } else {
        await dispatch(setActiveFeed(activeFeedID))
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
      dispatch(getSubscribersSuccess([]))
      return
    }
    await Promise.all([
      dispatch(fetchGuildFeedArticles(activeGuildID, feedID)),
      dispatch(fetchGuildFeedSubscribers(activeGuildID, feedID))
    ])
  }
}

export function fetchDeleteFeed (guildID, feedID) {
  return async dispatch => {
    try {
      dispatch(deleteFeedBegin())
      await axios.delete(`/api/guilds/${guildID}/feeds/${feedID}`)
      toast.success(`Successfully deleted feed!`)
      dispatch(deleteFeedSuccess(feedID))
    } catch (err) {
      dispatch(deleteFeedFailure(err))
    }
  }
}

export function fetchEditFeed (guildID, feedID, newData) {
  return async dispatch => {
    try {
      dispatch(editFeedBegin())
      const { data } = await axios.patch(`/api/guilds/${guildID}/feeds/${feedID}`, newData)
      toast.success(`Your changes have been saved`)
      dispatch(editFeedSuccess(data))
    } catch (err) {
      dispatch(editFeedFailure(err))
    }
  }
}
