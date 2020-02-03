import axios from 'axios'
import {
  SET_USER
} from '../constants/actions/user'
import { fetchGuilds } from './guilds'
import { fetchBotConfig } from './botConfig'
import FetchStatusActions from './utils/FetchStatusActions'

export const {
  begin: setUserBegin,
  success: setUserSuccess,
  failure: setUserFailure
} = new FetchStatusActions(SET_USER)

export function fetchUser () {
  return dispatch => {
    dispatch(fetchGuilds())
    dispatch(setUserBegin())
    dispatch(fetchBotConfig())
    axios.get('/api/users/@me').then(({ data, status }) => {
      dispatch(setUserSuccess(data))
    }).catch(err => {
      console.log(err)
      dispatch(setUserFailure(err))
    })
  }
}
