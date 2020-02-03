import axios from 'axios'
import { GET_BOT_CONFIG } from 'js/constants/actions/botConfig'

export function fetchBotConfig () {
  return async dispatch => {
    try {
      dispatch(getBotConfigBegin())
      const { data } = await axios.get(`/api/config`)
      dispatch(getBotConfigSuccess(data))
    } catch (err) {
      dispatch(getBotConfigFailure(err)) 
    }
  }
}

export function getBotConfigSuccess (channels) {
  return {
    type: GET_BOT_CONFIG.SUCCESS,
    payload: channels
  }
}

export function getBotConfigFailure (error) {
  return {
    type: GET_BOT_CONFIG.FAILURE,
    payload: error
  }
}

export function getBotConfigBegin () {
  return {
    type: GET_BOT_CONFIG.BEGIN
  }
}
