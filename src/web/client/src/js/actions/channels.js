import axios from 'axios'
import {
  GET_CHANNELS
} from '../constants/actions/channels'

export function fetchGuildChannels (guildID) {
  return dispatch => {
    dispatch(setChannelsBegin())
    axios.get(`/api/guilds/${guildID}/channels`).then(({ data }) => {
      dispatch(setChannelsSuccess(data))
    }).catch(err => {
      console.log(err)
      dispatch(setChannelsFailure(err))
    })
  }
}

export function setChannelsSuccess (channels) {
  return {
    type: GET_CHANNELS.SUCCESS,
    payload: channels
  }
}

export function setChannelsFailure () {
  return {
    type: GET_CHANNELS.FAILURE
  }
}

export function setChannelsBegin () {
  return {
    type: GET_CHANNELS.BEGIN
  }
}
