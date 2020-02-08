import axios from 'axios'
import FetchStatusActions from './utils/FetchStatusActions'
import { ADD_SUBSCRIBER, DELETE_SUBSCRIBER, EDIT_SUBSCRIBER, GET_SUBSCRIBERS } from 'js/constants/actions/subscribers'

export const {
  begin: addSubscriberBegin,
  success: addSubscriberSuccess,
  failure: addSubscriberFailure
} = new FetchStatusActions(ADD_SUBSCRIBER)

export const {
  begin: deleteSubscriberBegin,
  success: deleteSubscriberSuccess,
  failure: deleteSubscriberFailure
} = new FetchStatusActions(DELETE_SUBSCRIBER)

export const {
  begin: editSubscriberBegin,
  success: editSubscriberSuccess,
  failure: editSubscriberFailure
} = new FetchStatusActions(EDIT_SUBSCRIBER)

export const {
  begin: getSubscribersBegin,
  success: getSubscribersSuccess,
  failure: getSubscribersFailure
} = new FetchStatusActions(GET_SUBSCRIBERS)

export function fetchGuildFeedSubscribers (guildID, feedID) {
  return async dispatch => {
    try {
      dispatch(getSubscribersBegin())
      const { data } = await axios.get(`/api/guilds/${guildID}/feeds/${feedID}/subscribers`)
      dispatch(getSubscribersSuccess(data))
    } catch (err) {
      dispatch(getSubscribersFailure(err))
    }
  }
}

export function fetchAddSubscriber (guildID, feedID, subscriber) {
  return async dispatch => {
    try {
      dispatch(addSubscriberBegin())
      const { data } = await axios.post(`/api/guilds/${guildID}/feeds/${feedID}/subscribers`, subscriber)
      dispatch(addSubscriberSuccess(data))
    } catch (err) {
      dispatch(addSubscriberFailure(err))
    }
  }
}

export function fetchDeleteSubscriber (guildID, feedID, subscriberID) {
  return async dispatch => {
    try {
      dispatch(deleteSubscriberBegin())
      await axios.delete(`/api/guilds/${guildID}/feeds/${feedID}/subscribers/${subscriberID}`)
      dispatch(deleteSubscriberSuccess())
    } catch (err) {
      dispatch(deleteSubscriberFailure(err))
    }
  }
}

export function fetchEditSubscriber (guildID, feedID, subscriberID, newData) {
  return async dispatch => {
    try {
      dispatch(editSubscriberBegin())
      const { data } = await axios.patch(`/api/guilds/${guildID}/feeds/${feedID}/subscribers/${subscriberID}`, newData)
      dispatch(editSubscriberSuccess(data))
    } catch (err) {
      dispatch(editSubscriberFailure(err))
    }
  }
}
