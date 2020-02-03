import axios from 'axios'
import { GET_BOT_CONFIG } from 'js/constants/actions/botConfig'
import FetchStatusActions from './utils/FetchStatusActions'

export const {  
  begin: getBotConfigBegin,
  success: getBotConfigSuccess,
  failure: getBotConfigFailure
} = new FetchStatusActions(GET_BOT_CONFIG)

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
