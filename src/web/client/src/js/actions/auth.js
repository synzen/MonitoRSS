import axios from 'axios'
import FetchStatusActions from './utils/FetchStatusActions'
import { CHECK_AUTH } from 'js/constants/actions/auth'

export const {
  begin: checkAuthBegin,
  success: checkAuthSuccess,
  failure: checkAuthFailure
} = new FetchStatusActions(CHECK_AUTH)

export function fetchAuthentication () {
  return async dispatch => {
    try {
      dispatch(checkAuthBegin())
      const { data } = await axios.get(`/api/authenticated`)
      dispatch(checkAuthSuccess(data.authenticated))
    } catch (err) {
      dispatch(checkAuthFailure(err))
    }
  }
}
