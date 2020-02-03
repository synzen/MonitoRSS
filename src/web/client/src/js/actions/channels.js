import axios from 'axios'
import {
  GET_CHANNELS
} from '../constants/actions/channels'

export function fetchGuildChannels (guildID) {
  return async dispatch => {
    try {
      dispatch(setChannelsBegin())
      const { data } = await axios.get(`/api/guilds/${guildID}/channels`)
      dispatch(setChannelsSuccess(data))
    } catch (err) {
      dispatch(setChannelsFailure(err)) 
    }
  }
}

export function setChannelsSuccess (channels) {
  return {
    type: GET_CHANNELS.SUCCESS,
    payload: channels
  }
}

export function setChannelsFailure (error) {
  return {
    type: GET_CHANNELS.FAILURE,
    payload: error
  }
}

export function setChannelsBegin () {
  return {
    type: GET_CHANNELS.BEGIN
  }
}
