import axios from 'axios'
import {
  GET_CHANNELS
} from '../constants/actions/channels'
import FetchStatusActions from './utils/FetchStatusActions'

export const {
  begin: setChannelsBegin,
  success: setChannelsSuccess,
  failure: setChannelsFailure
} = new FetchStatusActions(GET_CHANNELS)

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
