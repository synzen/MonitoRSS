import axios from 'axios'
import {
  GET_ROLES
} from '../constants/actions/roles'
import FetchStatusActions from './utils/FetchStatusActions'

export const {
  begin: setRolesBegin,
  success: setRolesSuccess,
  failure: setRolesFailure
} = new FetchStatusActions(GET_ROLES)

export function fetchGuildRoles (guildID) {
  return async dispatch => {
    try {
      dispatch(setRolesBegin())
      const { data } = await axios.get(`/api/guilds/${guildID}/roles`)
      dispatch(setRolesSuccess(data))
    } catch (err) {
      dispatch(setRolesFailure(err))
    }
  }
}
